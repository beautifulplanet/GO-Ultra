import { useState, useEffect, useRef, useCallback } from 'react'
import { useGoEngine } from './useGoEngine'
import { SceneManager } from './three/SceneManager'
import GoBoard from './GoBoard'
import { Lobby } from './components/Lobby'
import { PlayerPanel } from './components/PlayerPanel'
import { ScorePanel } from './components/ScorePanel'
import { GameOverlay } from './components/GameOverlay'
import { TimerBar } from './components/TimerBar'
import { SettingsModal } from './components/SettingsModal'
import './styles/global.css'
import './styles/animations.css'
import './styles/themes.css'

type Phase = 'lobby' | 'playing' | 'game_over'
type RenderMode = '2d' | '3d'

const PLAYER_COLORS_HEX = ['#1a1a1a', '#f0ead6', '#8B1A1A']
const PLAYER_NAMES_SHORT = ['Obsidian', 'Ivory', 'Crimson']

// Difficulty → MCTS iterations
const DIFF_ITERATIONS = [10, 30, 60, 120, 250, 400, 600, 900, 1300, 2000]
// Lower difficulties play random moves sometimes
const DIFF_RANDOM_CHANCE = [0.7, 0.5, 0.35, 0.2, 0.1, 0.05, 0.02, 0.01, 0, 0]

function App() {
  const [phase, setPhase] = useState<Phase>('lobby')
  const [renderMode, setRenderMode] = useState<RenderMode>('2d')
  const [boardSize, setBoardSize] = useState(9)
  const [players, setPlayers] = useState(2)
  const [opponent, setOpponent] = useState<'ai' | 'local' | 'spectate'>('ai')
  const [timeControl, setTimeControl] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [allowSuicide, setAllowSuicide] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [winner, setWinner] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState(5)

  const sceneContainerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sceneReady, setSceneReady] = useState(false)

  const { ready, state, play, pass, aiMoveSync, newGame, setSuicide } = useGoEngine(boardSize, players)

  // Refs to avoid stale closures in 3D event listeners
  const stateRef = useRef(state)
  const thinkingRef = useRef(thinking)
  const opponentRef = useRef(opponent)
  stateRef.current = state
  thinkingRef.current = thinking
  opponentRef.current = opponent

  const getIterations = useCallback(() => {
    const base = DIFF_ITERATIONS[Math.min(difficulty - 1, 9)]
    if (boardSize >= 17) return Math.max(10, Math.floor(base * 0.4))
    if (boardSize >= 13) return Math.max(10, Math.floor(base * 0.6))
    return base
  }, [difficulty, boardSize])

  const getRandomChance = useCallback(() => DIFF_RANDOM_CHANCE[Math.min(difficulty - 1, 9)], [difficulty])

  // ── Sync suicide setting to WASM engine ──
  useEffect(() => { setSuicide(allowSuicide) }, [allowSuicide, setSuicide])

  // ── Start game from lobby ──
  const handleStart = (config: {
    boardSize: number; players: number; opponent: string;
    timeControl: number; difficulty: number; renderMode: string
  }) => {
    setBoardSize(config.boardSize)
    setPlayers(config.players)
    setOpponent(config.opponent as 'ai' | 'local' | 'spectate')
    setTimeControl(config.timeControl)
    setTimeLeft(config.timeControl)
    setDifficulty(config.difficulty)
    setRenderMode(config.renderMode as RenderMode)
    setWinner(null)
    setThinking(false)
    newGame(config.boardSize, config.players)
    setPhase('playing')
  }

  // ── 3D scene lifecycle ──
  useEffect(() => {
    if (phase !== 'playing' || renderMode !== '3d') return
    const container = sceneContainerRef.current
    if (!container) return

    // Clean up old scene
    if (sceneRef.current) {
      sceneRef.current.dispose()
      sceneRef.current = null
    }

    // Wait for layout
    setSceneReady(false)
    const raf = requestAnimationFrame(() => {
      const scene = new SceneManager(container, boardSize, 'high')
      sceneRef.current = scene
      scene.start()
      setSceneReady(true)
    })
    return () => { cancelAnimationFrame(raf); setSceneReady(false) }
  }, [phase, renderMode, boardSize])

  // ── 3D pointer events — only bind after scene is confirmed ready ──
  useEffect(() => {
    if (phase !== 'playing' || renderMode !== '3d' || !sceneReady) return
    const scene = sceneRef.current
    if (!scene) return
    const canvas = scene.getCanvas()

    const onPointerDown = (e: PointerEvent) => {
      const s = stateRef.current
      if (!s || thinkingRef.current || s.isGameOver) return
      if (opponentRef.current === 'ai' && s.turn !== 0) return
      const idx = scene.raycaster.getIntersection(e, canvas)
      if (idx >= 0 && s.legalMoves.has(idx)) {
        play(idx)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current
      if (!s) return
      canvas.style.cursor = scene.raycaster.getCursor(e, canvas, s.legalMoves)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
    }
  }, [phase, renderMode, play, sceneReady])

  // ── Sync stones to 3D scene ──
  useEffect(() => {
    if (renderMode !== '3d' || !state || !sceneRef.current) return
    sceneRef.current.stones.syncBoard(state.board, state.size)
  }, [renderMode, state?.board, state?.moveCount])

  // ── AI auto-move — works for both 2D and 3D ──
  const aiLockRef = useRef(false)
  useEffect(() => {
    if (phase !== 'playing' || !state || state.isGameOver) return
    if (opponent === 'local') return
    // In 'ai' mode: AI plays for all non-zero players (player 0 is human)
    // In 'spectate' mode: AI plays for ALL players
    if (opponent === 'ai' && state.turn === 0) { aiLockRef.current = false; return }
    if (aiLockRef.current) return
    aiLockRef.current = true

    setThinking(true)
    const delay = renderMode === '3d' ? 400 : (opponent === 'spectate' ? 600 : 150)
    const timeout = setTimeout(() => {
      const randomChance = getRandomChance()
      if (randomChance > 0 && Math.random() < randomChance && state.legalMoves.size > 0) {
        const moves = Array.from(state.legalMoves)
        play(moves[Math.floor(Math.random() * moves.length)])
      } else {
        aiMoveSync(getIterations())
      }
      setThinking(false)
      aiLockRef.current = false
    }, delay)
    return () => { clearTimeout(timeout); aiLockRef.current = false }
  }, [state?.moveCount, state?.turn, phase, opponent, renderMode, play, aiMoveSync, getIterations, getRandomChance])

  // ── Game over detection ──
  useEffect(() => {
    if (!state || !state.isGameOver || phase === 'game_over') return
    const scores = state.scores
    let w = 0
    for (let i = 1; i < players; i++) {
      if (scores[i] > scores[w]) w = i
    }
    setWinner(w)
    setPhase('game_over')
    if (renderMode === '3d' && sceneRef.current) {
      sceneRef.current.cameraCtrl.gameOverView()
      sceneRef.current.particles.confetti()
      sceneRef.current.stones.pulseWinner(state.board, w)
    }
  }, [state?.isGameOver, players, renderMode])

  // ── Timer — resets on turn change only ──
  const passRef = useRef(pass)
  passRef.current = pass
  useEffect(() => {
    if (phase !== 'playing' || timeControl <= 0) return
    setTimeLeft(timeControl)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          passRef.current()
          return timeControl
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, state?.turn, timeControl])

  // ── Handlers ──
  const handlePlay2D = useCallback((pos: number) => {
    if (!state || thinking || state.isGameOver) return
    if (opponent === 'ai' && state.turn !== 0) return
    play(pos)
  }, [state, thinking, opponent, play])

  const handlePass = () => {
    if (thinking || !state || state.isGameOver) return
    if (opponent === 'spectate') return
    if (state.turn !== 0 && opponent === 'ai') return
    pass()
  }

  const handleNewGame = () => {
    setWinner(null)
    setThinking(false)
    aiLockRef.current = false
    if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null }
    setSceneReady(false)
    newGame(boardSize, players)
    setPhase('playing')
  }

  const handleBackToLobby = () => {
    if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null }
    setPhase('lobby')
    setShowSettings(false)
    setThinking(false)
    setWinner(null)
  }

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => { if (sceneRef.current) { sceneRef.current.dispose() } }
  }, [])

  // ═══ RENDER ═══

  if (phase === 'lobby') {
    return <Lobby onStart={handleStart} ready={ready} />
  }

  if (!state) return null

  const playerTypes = Array.from({ length: players }, (_, i) =>
    opponent === 'spectate' ? 'AI' :
    i === 0 ? 'Human' : (opponent === 'ai' ? 'AI' : 'Human')
  )
  const capturesArr = Array.from({ length: players }, (_, i) => state.captures[i] || 0)
  const isDisabled = thinking || state.isGameOver || opponent === 'spectate' || (state.turn !== 0 && opponent === 'ai')

  return (
    <>
      {/* 3D background (only in 3D mode) */}
      {renderMode === '3d' && <div ref={sceneContainerRef} className="scene-canvas" />}

      {/* 2D board (only in 2D mode) */}
      {renderMode === '2d' && (
        <div className="board-2d-wrapper">
          <GoBoard state={state} onPlay={handlePlay2D} disabled={isDisabled} />
        </div>
      )}

      {/* UI overlay */}
      <div className={renderMode === '3d' ? 'ui-overlay' : 'ui-overlay ui-overlay-2d'}>
        <div className="header">
          Go Chronicle
          <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
        </div>

        <PlayerPanel
          turn={state.turn}
          players={players}
          captures={capturesArr}
          types={playerTypes}
        />

        <ScorePanel
          scores={state.scores}
          players={players}
          onPass={handlePass}
          onNewGame={handleNewGame}
          disabled={isDisabled}
        />

        {timeControl > 0 && (
          <TimerBar
            timeLeft={timeLeft}
            totalTime={timeControl}
            playerColor={PLAYER_COLORS_HEX[state.turn]}
          />
        )}

        {thinking && <div className="thinking">AI thinking…</div>}

        {phase === 'game_over' && winner !== null && (
          <GameOverlay
            text={`${PLAYER_NAMES_SHORT[winner]} wins!`}
            subtitle={Array.from({ length: players }, (_, i) => state.scores[i].toFixed(1)).join(' — ')}
          />
        )}
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          showValidMoves={false}
          setShowValidMoves={() => {}}
          showTerritory={false}
          setShowTerritory={() => {}}
          allowSuicide={allowSuicide}
          setAllowSuicide={setAllowSuicide}
          onNewGame={handleNewGame}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </>
  )
}

export default App

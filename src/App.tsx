import { useState, useEffect, useRef } from 'react'
import { useGoEngine } from './useGoEngine'
import { SceneManager } from './three/SceneManager'
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

const PLAYER_COLORS_HEX = ['#1a1a1a', '#f0ead6', '#8B1A1A']
const PLAYER_NAMES_SHORT = ['Obsidian', 'Ivory', 'Crimson']

function App() {
  const [phase, setPhase] = useState<Phase>('lobby')
  const [boardSize, setBoardSize] = useState(9)
  const [players, setPlayers] = useState(2)
  const [opponent, setOpponent] = useState<'ai' | 'local'>('ai')
  const [timeControl, setTimeControl] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showValidMoves, setShowValidMoves] = useState(true)
  const [showTerritory, setShowTerritory] = useState(false)
  const [allowSuicide, setAllowSuicide] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [winner, setWinner] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState(5)

  const sceneContainerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { ready, state, play, pass, aiMoveSync, newGame } = useGoEngine(boardSize, players)

  // Refs to avoid stale closures in event listeners
  const stateRef = useRef(state)
  const thinkingRef = useRef(thinking)
  const opponentRef = useRef(opponent)
  const playersRef = useRef(players)
  stateRef.current = state
  thinkingRef.current = thinking
  opponentRef.current = opponent
  playersRef.current = players

  // Map difficulty (1-10) to MCTS iterations, scaled by board size.
  // Level 1 = near-random (10 iters), Level 10 = full strength (2000 iters on 9x9)
  const DIFF_ITERATIONS = [10, 30, 60, 120, 250, 400, 600, 900, 1300, 2000]
  // Lower difficulties also have a chance to play a random legal move instead
  const DIFF_RANDOM_CHANCE = [0.7, 0.5, 0.35, 0.2, 0.1, 0.05, 0.02, 0.01, 0, 0]

  const getIterations = () => {
    const base = DIFF_ITERATIONS[Math.min(difficulty - 1, 9)]
    // Scale down for larger boards to keep responsive
    if (boardSize >= 17) return Math.max(10, Math.floor(base * 0.4))
    if (boardSize >= 13) return Math.max(10, Math.floor(base * 0.6))
    return base
  }

  const getRandomChance = () => DIFF_RANDOM_CHANCE[Math.min(difficulty - 1, 9)]

  // Start game from lobby
  const handleStart = (config: { boardSize: number; players: number; opponent: string; timeControl: number; difficulty: number }) => {
    setBoardSize(config.boardSize)
    setPlayers(config.players)
    setOpponent(config.opponent as 'ai' | 'local')
    setTimeControl(config.timeControl)
    setTimeLeft(config.timeControl)
    setDifficulty(config.difficulty)
    setWinner(null)
    newGame(config.boardSize, config.players)

    // Build Three.js scene immediately
    const container = sceneContainerRef.current
    if (!container) return

    // Clean up old scene
    if (sceneRef.current) {
      sceneRef.current.dispose()
      sceneRef.current = null
    }

    const scene = new SceneManager(container, config.boardSize, 'high')
    sceneRef.current = scene
    scene.start()
    setPhase('playing')
  }

  // Wire up pointer events on the canvas — uses refs to avoid stale closures
  useEffect(() => {
    if (phase !== 'playing') return
    const scene = sceneRef.current
    if (!scene) return
    const canvas = scene.getCanvas()

    const onPointerDown = (e: PointerEvent) => {
      const s = stateRef.current
      if (!s || thinkingRef.current || s.isGameOver) return
      if (s.turn !== 0 && opponentRef.current === 'ai') return

      const idx = scene.raycaster.getIntersection(e, canvas)
      if (idx >= 0 && s.legalMoves.has(idx)) {
        const ok = play(idx)
        if (ok) {
          scene.particles.dustRing(idx, s.size)
        }
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
  }, [phase, play])

  // Sync stones to 3D scene when state changes
  useEffect(() => {
    if (!state || !sceneRef.current) return
    sceneRef.current.stones.syncBoard(state.board, state.size)
  }, [state?.board, state?.moveCount])

  // AI auto-move: after human plays, if it's AI's turn, trigger AI
  useEffect(() => {
    if (phase !== 'playing' || !state || state.isGameOver || thinking) return
    if (opponent !== 'ai') return
    // AI plays for all non-zero players
    if (state.turn === 0) return

    setThinking(true)
    const timeout = setTimeout(() => {
      // At lower difficulties, sometimes play a random legal move
      const randomChance = getRandomChance()
      if (randomChance > 0 && Math.random() < randomChance && state.legalMoves.size > 0) {
        const moves = Array.from(state.legalMoves)
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        play(randomMove)
      } else {
        aiMoveSync(getIterations())
      }
      setThinking(false)
    }, 80)
    return () => clearTimeout(timeout)
  }, [state?.moveCount, state?.turn, phase, opponent])

  // Game over detection
  useEffect(() => {
    if (!state || !state.isGameOver || phase === 'game_over') return
    const scores = state.scores
    let w = 0
    for (let i = 1; i < players; i++) {
      if (scores[i] > scores[w]) w = i
    }
    setWinner(w)
    setPhase('game_over')
    if (sceneRef.current) {
      sceneRef.current.cameraCtrl.gameOverView()
      sceneRef.current.particles.confetti()
      sceneRef.current.stones.pulseWinner(state.board, w)
    }
  }, [state?.isGameOver, players])

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || timeControl <= 0 || thinking) return
    setTimeLeft(timeControl)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          pass()
          return timeControl
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, state?.turn, thinking, timeControl, pass])

  const handlePass = () => {
    if (thinking || !state || state.isGameOver) return
    if (state.turn !== 0 && opponent === 'ai') return
    pass()
    // AI response is handled by the auto-move useEffect
  }

  const handleNewGame = () => {
    setWinner(null)
    setThinking(false)
    newGame(boardSize, players)
    // Rebuild scene
    const container = sceneContainerRef.current
    if (container && sceneRef.current) {
      sceneRef.current.dispose()
      const scene = new SceneManager(container, boardSize, 'high')
      sceneRef.current = scene
      scene.start()
    }
    setPhase('playing')
  }

  const handleBackToLobby = () => {
    if (sceneRef.current) {
      sceneRef.current.dispose()
      sceneRef.current = null
    }
    setPhase('lobby')
    setShowSettings(false)
    setThinking(false)
    setWinner(null)
  }

  // LOBBY
  if (phase === 'lobby') {
    return (
      <>
        <div ref={sceneContainerRef} className="scene-canvas" />
        <Lobby onStart={handleStart} ready={ready} />
      </>
    )
  }

  if (!state) return null

  const playerTypes = Array.from({ length: players }, (_, i) =>
    i === 0 ? 'Human' : (opponent === 'ai' ? 'AI' : 'Human')
  )

  const capturesArr = Array.from({ length: players }, (_, i) => state.captures[i] || 0)

  return (
    <>
      {/* Three.js canvas container */}
      <div ref={sceneContainerRef} className="scene-canvas" />

      {/* 2D UI overlay */}
      <div className="ui-overlay">
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
          disabled={thinking || state.isGameOver || (state.turn !== 0 && opponent === 'ai')}
        />

        {timeControl > 0 && phase === 'playing' && (
          <TimerBar
            timeLeft={timeLeft}
            totalTime={timeControl}
            playerColor={PLAYER_COLORS_HEX[state.turn]}
          />
        )}

        {thinking && (
          <div className="thinking">AI thinking…</div>
        )}

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
          showValidMoves={showValidMoves}
          setShowValidMoves={setShowValidMoves}
          showTerritory={showTerritory}
          setShowTerritory={setShowTerritory}
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

import { useState, useCallback, useEffect, useRef } from 'react'
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

type Phase = 'lobby' | 'loading' | 'playing' | 'game_over'

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

  const sceneContainerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { ready, state, play, pass, aiMove, newGame } = useGoEngine(boardSize, players)

  // Scale iterations by board size
  const getIterations = useCallback(() => {
    if (boardSize <= 9) return 500
    if (boardSize <= 13) return 300
    return 200
  }, [boardSize])

  // Start game from lobby
  const handleStart = useCallback((config: { boardSize: number; players: number; opponent: string; timeControl: number }) => {
    setBoardSize(config.boardSize)
    setPlayers(config.players)
    setOpponent(config.opponent as 'ai' | 'local')
    setTimeControl(config.timeControl)
    setTimeLeft(config.timeControl)
    setWinner(null)
    newGame(config.boardSize, config.players)
    setPhase('loading')
  }, [newGame])

  // Initialize Three.js scene when entering loading/playing phase
  useEffect(() => {
    if (phase !== 'loading') return
    const container = sceneContainerRef.current
    if (!container) return

    // Clean up old scene
    if (sceneRef.current) {
      sceneRef.current.dispose()
      sceneRef.current = null
    }

    const scene = new SceneManager(container, boardSize, 'high')
    sceneRef.current = scene
    scene.start()

    // Wire up click handling on the canvas
    const canvas = scene.getCanvas()
    canvas.addEventListener('pointerdown', handleCanvasClick)
    canvas.addEventListener('pointermove', handleCanvasMove)

    setPhase('playing')

    return () => {
      canvas.removeEventListener('pointerdown', handleCanvasClick)
      canvas.removeEventListener('pointermove', handleCanvasMove)
    }
  }, [phase === 'loading', boardSize])

  // Sync stones to 3D scene when state changes
  useEffect(() => {
    if (!state || !sceneRef.current) return
    sceneRef.current.stones.syncBoard(state.board, state.size)
  }, [state?.board, state?.moveCount])

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
  }, [state?.isGameOver])

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || timeControl <= 0 || thinking) return
    setTimeLeft(timeControl)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-pass
          pass()
          return timeControl
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, state?.turn, thinking, timeControl])

  // Canvas click → play stone
  const handleCanvasClick = useCallback((e: PointerEvent) => {
    const scene = sceneRef.current
    if (!scene || !state || thinking || state.isGameOver) return
    if (state.turn !== 0 && opponent === 'ai') return

    const canvas = scene.getCanvas()
    const idx = scene.raycaster.getIntersection(e as PointerEvent, canvas)
    if (idx >= 0 && state.legalMoves.has(idx)) {
      const ok = play(idx)
      if (ok) {
        scene.particles.dustRing(idx, state.size)
        if (opponent === 'ai') {
          setThinking(true)
          aiMove(getIterations(), () => setThinking(false))
        }
      }
    }
  }, [state, thinking, opponent, play, aiMove, getIterations])

  // Canvas hover cursor
  const handleCanvasMove = useCallback((e: PointerEvent) => {
    const scene = sceneRef.current
    if (!scene || !state) return
    const canvas = scene.getCanvas()
    canvas.style.cursor = scene.raycaster.getCursor(e as PointerEvent, canvas, state.legalMoves)
  }, [state])

  const handlePass = useCallback(() => {
    if (thinking || !state || state.isGameOver) return
    if (state.turn !== 0 && opponent === 'ai') return
    pass()
    if (opponent === 'ai' && !state?.isGameOver) {
      setThinking(true)
      aiMove(getIterations(), () => setThinking(false))
    }
  }, [thinking, state, opponent, pass, aiMove, getIterations])

  const handleNewGame = useCallback(() => {
    setWinner(null)
    newGame(boardSize, players)
    setPhase('loading')
  }, [boardSize, players, newGame])

  const handleBackToLobby = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.dispose()
      sceneRef.current = null
    }
    setPhase('lobby')
    setShowSettings(false)
    setThinking(false)
    setWinner(null)
  }, [])

  // LOBBY
  if (phase === 'lobby') {
    return <Lobby onStart={handleStart} ready={ready} />
  }

  if (!state) return null

  const playerTypes = Array.from({ length: players }, (_, i) =>
    i === 0 ? 'Human' : (opponent === 'ai' ? 'AI' : 'Human')
  )

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
          captures={Array.from({ length: players }, (_, i) => state.captures[i] || 0)}
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
          <div className="thinking">AI thinking</div>
        )}

        {phase === 'game_over' && winner !== null && (
          <GameOverlay
            text={`${PLAYER_NAMES_SHORT[winner]} wins!`}
            subtitle={`${state.scores[0].toFixed(1)} — ${state.scores[1].toFixed(1)}${players > 2 ? ` — ${state.scores[2].toFixed(1)}` : ''}`}
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

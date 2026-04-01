import { useState, useCallback } from 'react'
import { useGoEngine } from './useGoEngine'
import GoBoard from './GoBoard'

type Mode = 'menu' | 'playing'
type Opponent = 'ai' | 'local'

const SIZES = [9, 13, 15, 17, 19] as const
const PLAYER_NAMES = ['Black', 'White', 'Crimson']
const PLAYER_COLORS = ['#222', '#f0f0f0', '#dc143c']

function App() {
  const [mode, setMode] = useState<Mode>('menu')
  const [boardSize, setBoardSize] = useState(9)
  const [opponent, setOpponent] = useState<Opponent>('ai')
  const [thinking, setThinking] = useState(false)

  const { ready, state, play, pass, aiMove, newGame } = useGoEngine(boardSize, 2)

  const handleStart = () => {
    newGame(boardSize, 2)
    setMode('playing')
  }

  // Scale iterations by board size — bigger boards need fewer to stay responsive
  const getIterations = useCallback(() => {
    if (boardSize <= 9) return 500
    if (boardSize <= 13) return 300
    return 200
  }, [boardSize])

  const handlePlay = useCallback((pos: number) => {
    if (thinking || !state || state.isGameOver) return
    if (state.turn !== 0 && opponent === 'ai') return // not player's turn

    const ok = play(pos)
    if (ok && opponent === 'ai') {
      setThinking(true)
      // AI runs in Web Worker — non-blocking
      aiMove(getIterations(), () => setThinking(false))
    }
  }, [thinking, state, opponent, play, aiMove, getIterations])

  const handlePass = () => {
    if (thinking || !state || state.isGameOver) return
    if (state.turn !== 0 && opponent === 'ai') return
    pass()
    if (opponent === 'ai' && !state.isGameOver) {
      setThinking(true)
      aiMove(getIterations(), () => setThinking(false))
    }
  }

  const handleNewGame = () => {
    setMode('menu')
    setThinking(false)
  }

  // Menu screen
  if (mode === 'menu') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Go Chronicle</h1>
        <p style={styles.subtitle}>Ancient game. Rust engine. Your board.</p>

        <div style={styles.menuCard}>
          <label style={styles.label}>Board Size</label>
          <div style={styles.sizeRow}>
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => setBoardSize(s)}
                style={{
                  ...styles.sizeBtn,
                  background: boardSize === s ? '#c9a227' : '#2a2a3a',
                  color: boardSize === s ? '#0a0a0f' : '#e8e8f0',
                }}
              >
                {s}×{s}
              </button>
            ))}
          </div>

          <label style={{ ...styles.label, marginTop: 20 }}>Opponent</label>
          <div style={styles.sizeRow}>
            <button
              onClick={() => setOpponent('ai')}
              style={{
                ...styles.sizeBtn, flex: 1,
                background: opponent === 'ai' ? '#c9a227' : '#2a2a3a',
                color: opponent === 'ai' ? '#0a0a0f' : '#e8e8f0',
              }}
            >
              vs AI
            </button>
            <button
              onClick={() => setOpponent('local')}
              style={{
                ...styles.sizeBtn, flex: 1,
                background: opponent === 'local' ? '#c9a227' : '#2a2a3a',
                color: opponent === 'local' ? '#0a0a0f' : '#e8e8f0',
              }}
            >
              Local PvP
            </button>
          </div>

          <button
            onClick={handleStart}
            disabled={!ready}
            style={{
              ...styles.startBtn,
              opacity: ready ? 1 : 0.4,
            }}
          >
            {ready ? 'Start Game' : 'Loading Engine...'}
          </button>
        </div>
      </div>
    )
  }

  // Game screen
  if (!state) return null

  const turnName = PLAYER_NAMES[state.turn]
  const turnColor = PLAYER_COLORS[state.turn]

  return (
    <div style={styles.container}>
      <div style={styles.gameLayout}>
        {/* Info panel */}
        <div style={styles.infoPanel}>
          <h2 style={styles.gameTitle}>Go Chronicle</h2>
          <div style={styles.boardLabel}>{boardSize}×{boardSize}</div>

          <div style={styles.statusBox}>
            {state.isGameOver ? (
              <>
                <div style={styles.statusText}>Game Over</div>
                <div style={styles.scoreText}>
                  Black: {state.scores[0].toFixed(1)} — White: {state.scores[1].toFixed(1)}
                </div>
                <div style={{
                  ...styles.statusText,
                  color: state.scores[0] > state.scores[1] ? PLAYER_COLORS[0] : PLAYER_COLORS[1],
                  fontSize: 18,
                  marginTop: 6,
                }}>
                  {state.scores[0] > state.scores[1] ? 'Black wins!' : 'White wins!'}
                </div>
              </>
            ) : (
              <>
                <div style={styles.statusText}>
                  {thinking ? 'AI thinking...' : (
                    <><span style={{ color: turnColor }}>●</span> {turnName} to play</>
                  )}
                </div>
                <div style={styles.moveCount}>Move {state.moveCount}</div>
              </>
            )}
          </div>

          <div style={styles.captureRow}>
            <div>
              <span style={{ color: PLAYER_COLORS[0] }}>●</span> Black captures: {state.captures[0]}
            </div>
            <div>
              <span style={{ color: PLAYER_COLORS[1] }}>●</span> White captures: {state.captures[1]}
            </div>
          </div>

          <div style={styles.scoreRow}>
            <div>Score: {state.scores[0].toFixed(1)} — {state.scores[1].toFixed(1)}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Komi: 6.5 for White</div>
          </div>

          <div style={styles.btnRow}>
            <button onClick={handlePass} disabled={thinking || state.isGameOver} style={styles.actionBtn}>
              Pass
            </button>
            <button onClick={handleNewGame} style={styles.actionBtn}>
              New Game
            </button>
          </div>
        </div>

        {/* Board */}
        <GoBoard
          state={state}
          onPlay={handlePlay}
          disabled={thinking || state.isGameOver}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e8e8f0',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  title: {
    fontFamily: "'Cinzel', serif",
    fontSize: 48,
    margin: 0,
    color: '#c9a227',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 8,
    marginBottom: 32,
  },
  menuCard: {
    background: '#16161f',
    borderRadius: 12,
    padding: '28px 36px',
    minWidth: 360,
  },
  label: {
    display: 'block',
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginBottom: 10,
    opacity: 0.5,
  },
  sizeRow: {
    display: 'flex',
    gap: 8,
  },
  sizeBtn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  startBtn: {
    width: '100%',
    marginTop: 28,
    padding: '14px 0',
    background: '#c9a227',
    color: '#0a0a0f',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  gameLayout: {
    display: 'flex',
    gap: 32,
    alignItems: 'flex-start',
    padding: 24,
  },
  infoPanel: {
    minWidth: 220,
    maxWidth: 240,
  },
  gameTitle: {
    fontFamily: "'Cinzel', serif",
    color: '#c9a227',
    margin: 0,
    fontSize: 22,
  },
  boardLabel: {
    fontSize: 13,
    opacity: 0.4,
    marginBottom: 20,
  },
  statusBox: {
    background: '#16161f',
    borderRadius: 8,
    padding: '14px 16px',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 15,
    fontWeight: 600,
  },
  moveCount: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 4,
  },
  scoreText: {
    fontSize: 14,
    marginTop: 6,
  },
  captureRow: {
    fontSize: 13,
    lineHeight: 1.8,
    opacity: 0.8,
    marginBottom: 12,
  },
  scoreRow: {
    background: '#16161f',
    borderRadius: 8,
    padding: '10px 16px',
    marginBottom: 20,
    fontSize: 14,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    padding: '10px 0',
    background: '#2a2a3a',
    color: '#e8e8f0',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
}

export default App

import { useState, useEffect, useCallback } from 'react'
import { useGoEngine } from './useGoEngine'
import GoBoard from './GoBoard'

const NAMES = ['Black', 'White', 'Crimson']

function App() {
  const [started, setStarted] = useState(false)
  const [boardSize, setBoardSize] = useState(9)
  const [players, setPlayers] = useState(2)
  const [mode, setMode] = useState<'pvp' | 'ai'>('ai')
  const [thinking, setThinking] = useState(false)

  const { ready, state, play, pass, aiMoveSync, newGame } = useGoEngine(boardSize, players)

  // AI auto-move
  useEffect(() => {
    if (!started || !state || state.isGameOver || thinking) return
    if (mode !== 'ai') return
    if (state.turn === 0) return // human's turn

    setThinking(true)
    const t = setTimeout(() => {
      aiMoveSync(200)
      setThinking(false)
    }, 200)
    return () => clearTimeout(t)
  }, [started, state?.moveCount, state?.turn, mode, thinking, aiMoveSync])

  const handlePlay = useCallback((pos: number) => {
    if (!state || thinking || state.isGameOver) return
    if (mode === 'ai' && state.turn !== 0) return
    play(pos)
  }, [state, thinking, mode, play])

  // ── LOBBY ──
  if (!started) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, fontFamily: 'sans-serif', background: '#1a1a2e', color: '#eee' }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>Go Chronicle</h1>
        <p>Ancient game. Rust engine. Your board.</p>

        <div style={{ display: 'flex', gap: 8 }}>
          {[9, 13, 19].map(s => (
            <button key={s} onClick={() => setBoardSize(s)}
              style={{ padding: '8px 16px', fontSize: 16, background: boardSize === s ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              {s}×{s}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPlayers(2)}
            style={{ padding: '8px 16px', fontSize: 16, background: players === 2 ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            2 Players
          </button>
          <button onClick={() => { setPlayers(3); if (boardSize < 13) setBoardSize(13) }}
            style={{ padding: '8px 16px', fontSize: 16, background: players === 3 ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            3 Players
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('ai')}
            style={{ padding: '8px 16px', fontSize: 16, background: mode === 'ai' ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            vs AI
          </button>
          <button onClick={() => setMode('pvp')}
            style={{ padding: '8px 16px', fontSize: 16, background: mode === 'pvp' ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Local PvP
          </button>
        </div>

        <button
          disabled={!ready}
          onClick={() => { newGame(boardSize, players); setStarted(true) }}
          style={{ padding: '12px 32px', fontSize: 20, background: ready ? '#22c55e' : '#555', color: '#fff', border: 'none', borderRadius: 8, cursor: ready ? 'pointer' : 'default', marginTop: 16 }}>
          {ready ? 'Start Game' : 'Loading engine…'}
        </button>
      </div>
    )
  }

  // ── GAME ──
  if (!state) return <div style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Loading...</div>

  const isDisabled = thinking || state.isGameOver || (mode === 'ai' && state.turn !== 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#1a1a2e', color: '#eee', fontFamily: 'sans-serif', paddingTop: 16 }}>
      {/* Header */}
      <h2 style={{ margin: '0 0 8px 0' }}>Go Chronicle — {boardSize}×{boardSize}</h2>

      {/* Turn + status */}
      <div style={{ fontSize: 18, marginBottom: 8 }}>
        {state.isGameOver
          ? '🏆 Game Over'
          : `Turn: ${NAMES[state.turn]}${thinking ? ' (AI thinking…)' : ''}`}
      </div>

      {/* Captures */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 16 }}>
        {Array.from({ length: players }, (_, i) => (
          <span key={i}>{NAMES[i]}: {state.captures[i] || 0} captures</span>
        ))}
      </div>

      {/* Board */}
      <GoBoard state={state} onPlay={handlePlay} disabled={isDisabled} />

      {/* Scores */}
      <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 16 }}>
        {Array.from({ length: players }, (_, i) => (
          <span key={i}>{NAMES[i]}: {state.scores[i]?.toFixed(1)} pts</span>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={pass} disabled={isDisabled}
          style={{ padding: '8px 24px', fontSize: 16, background: '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Pass
        </button>
        <button onClick={() => { newGame(boardSize, players); setThinking(false) }}
          style={{ padding: '8px 24px', fontSize: 16, background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          New Game
        </button>
        <button onClick={() => { setStarted(false); setThinking(false) }}
          style={{ padding: '8px 24px', fontSize: 16, background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          ← Lobby
        </button>
      </div>
    </div>
  )
}

export default App

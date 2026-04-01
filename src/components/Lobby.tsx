import { useState, useEffect } from 'react'

type Props = {
  onStart: (config: { boardSize: number; players: number; opponent: string; timeControl: number; difficulty: number; renderMode: string }) => void
  ready: boolean
}

const SIZES = [9, 13, 15, 17, 19] as const
const TIME_OPTIONS = [0, 10, 30, 60] as const
const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const DIFF_LABELS: Record<number, string> = {
  1: 'Random', 2: 'Beginner', 3: 'Novice', 4: 'Casual', 5: 'Club',
  6: 'Strong', 7: 'Expert', 8: 'Master', 9: 'Pro', 10: 'Demon',
}

export function Lobby({ onStart, ready }: Props) {
  const [boardSize, setBoardSize] = useState(9)
  const [players, setPlayers] = useState(2)
  const [opponent, setOpponent] = useState<'ai' | 'local' | 'spectate'>('ai')
  const [timeControl, setTimeControl] = useState(0)
  const [difficulty, setDifficulty] = useState(5)
  const [renderMode, setRenderMode] = useState<'2d' | '3d'>('2d')
  const [titleChars, setTitleChars] = useState(0)

  const title = 'Go Chronicle'

  // Letterpress animation
  useEffect(() => {
    if (titleChars >= title.length) return
    const t = setTimeout(() => setTitleChars(c => c + 1), 30)
    return () => clearTimeout(t)
  }, [titleChars])

  return (
    <div className="lobby">
      <h1 className="lobby-title">
        {title.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              opacity: i < titleChars ? 1 : 0,
              transform: i < titleChars ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'all 0.15s ease',
              display: 'inline-block',
              width: ch === ' ' ? '0.4em' : undefined,
            }}
          >
            {ch}
          </span>
        ))}
      </h1>
      <p className="lobby-subtitle">Ancient game. Rust engine. Your board.</p>

      <div className="lobby-card frosted">
        <div className="lobby-label">Board size</div>
        <div className="lobby-row">
          {SIZES.map(s => (
            <button
              key={s}
              className={`lobby-btn ${boardSize === s ? 'selected' : ''}`}
              onClick={() => setBoardSize(s)}
            >
              {s}×{s}
            </button>
          ))}
        </div>

        <div className="lobby-label">Players</div>
        <div className="lobby-row">
          <button
            className={`lobby-btn ${players === 2 ? 'selected' : ''}`}
            onClick={() => setPlayers(2)}
          >
            2
          </button>
          <button
            className={`lobby-btn ${players === 3 ? 'selected' : ''}`}
            onClick={() => { if (boardSize >= 13) setPlayers(3) }}
            style={{ opacity: boardSize >= 13 ? 1 : 0.4 }}
            title={boardSize < 13 ? '3 players requires 13×13+' : 'Experimental mode'}
          >
            3*
          </button>
        </div>

        <div className="lobby-label">Mode</div>
        <div className="lobby-row">
          <button
            className={`lobby-btn ${opponent === 'ai' ? 'selected' : ''}`}
            onClick={() => setOpponent('ai')}
            style={{ flex: 1 }}
          >
            vs AI
          </button>
          <button
            className={`lobby-btn ${opponent === 'local' ? 'selected' : ''}`}
            onClick={() => setOpponent('local')}
            style={{ flex: 1 }}
          >
            Local PvP
          </button>
          <button
            className={`lobby-btn ${opponent === 'spectate' ? 'selected' : ''}`}
            onClick={() => setOpponent('spectate')}
            style={{ flex: 1 }}
            title="Watch AIs battle each other"
          >
            AI vs AI
          </button>
        </div>

        <div className="lobby-label">Time control</div>
        <div className="lobby-row">
          {TIME_OPTIONS.map(t => (
            <button
              key={t}
              className={`lobby-btn ${timeControl === t ? 'selected' : ''}`}
              onClick={() => setTimeControl(t)}
            >
              {t === 0 ? 'Off' : `${t}s`}
            </button>
          ))}
        </div>

        {(opponent === 'ai' || opponent === 'spectate') && (
          <>
            <div className="lobby-label">AI Difficulty — {DIFF_LABELS[difficulty]}</div>
            <div className="lobby-row difficulty-row">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  className={`lobby-btn diff-btn ${difficulty === d ? 'selected' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="lobby-label">Render mode</div>
        <div className="lobby-row">
          <button
            className={`lobby-btn ${renderMode === '2d' ? 'selected' : ''}`}
            onClick={() => setRenderMode('2d')}
            style={{ flex: 1 }}
          >
            2D Classic
          </button>
          <button
            className={`lobby-btn ${renderMode === '3d' ? 'selected' : ''}`}
            onClick={() => setRenderMode('3d')}
            style={{ flex: 1 }}
          >
            3D Scene
          </button>
        </div>

        <button
          className="lobby-start btn btn-accent"
          onClick={() => onStart({ boardSize, players, opponent, timeControl, difficulty, renderMode })}
          disabled={!ready}
          style={{ opacity: ready ? 1 : 0.4 }}
        >
          {ready ? 'Start Game' : 'Loading Engine...'}
        </button>
      </div>
    </div>
  )
}

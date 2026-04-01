import { useState, useEffect } from 'react'

type Props = {
  onStart: (config: { boardSize: number; players: number; opponent: string; timeControl: number }) => void
  ready: boolean
}

const SIZES = [9, 13, 15, 17, 19] as const
const TIME_OPTIONS = [0, 10, 30, 60] as const

export function Lobby({ onStart, ready }: Props) {
  const [boardSize, setBoardSize] = useState(9)
  const [players, setPlayers] = useState(2)
  const [opponent, setOpponent] = useState<'ai' | 'local'>('ai')
  const [timeControl, setTimeControl] = useState(0)
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

        <button
          className="lobby-start btn btn-accent"
          onClick={() => onStart({ boardSize, players, opponent, timeControl })}
          disabled={!ready}
          style={{ opacity: ready ? 1 : 0.4 }}
        >
          {ready ? 'Start Game' : 'Loading Engine...'}
        </button>
      </div>
    </div>
  )
}

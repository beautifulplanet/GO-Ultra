const PLAYER_NAMES = ['Obsidian', 'Ivory', 'Crimson']
const PLAYER_DOTS = ['#1a1a1a', '#f0ead6', '#8B1A1A']

type Props = {
  scores: Float32Array | number[]
  players: number
  onPass: () => void
  onNewGame: () => void
  disabled: boolean
}

export function ScorePanel({ scores, players, onPass, onNewGame, disabled }: Props) {
  return (
    <div className="score-panel frosted">
      {Array.from({ length: players }, (_, i) => (
        <div key={i} className="score-row">
          <span>
            <span className="dot" style={{ backgroundColor: PLAYER_DOTS[i] }} />
            {PLAYER_NAMES[i]}
          </span>
          <span className="score-value">{(scores[i] || 0).toFixed(1)}</span>
        </div>
      ))}
      <button className="btn" onClick={onPass} disabled={disabled}>
        Pass
      </button>
      <button className="btn" onClick={onNewGame}>
        New Game
      </button>
    </div>
  )
}

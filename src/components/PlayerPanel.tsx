import { useEffect, useRef } from 'react'

const PLAYER_NAMES = ['Obsidian', 'Ivory', 'Crimson']
const PLAYER_DOTS = ['#1a1a1a', '#f0ead6', '#8B1A1A']

type Props = {
  turn: number
  players: number
  captures: number[]
  types: string[] // 'Human' | 'AI'
}

export function PlayerPanel({ turn, players, captures, types }: Props) {
  const prevTurn = useRef(turn)

  useEffect(() => {
    prevTurn.current = turn
  }, [turn])

  return (
    <div className="player-panel frosted">
      {Array.from({ length: players }, (_, i) => {
        const isActive = turn === i
        const justActivated = isActive && prevTurn.current !== i
        return (
          <div
            key={i}
            className={`player-card ${isActive ? 'active' : ''}`}
            style={{
              borderColor: isActive ? PLAYER_DOTS[i] : 'transparent',
              boxShadow: isActive ? `0 0 12px ${PLAYER_DOTS[i]}40` : 'none',
              animation: justActivated ? 'cardActivate 0.4s ease' : undefined,
            }}
          >
            <div>
              <span className="dot" style={{ backgroundColor: PLAYER_DOTS[i] }} />
              <span className="name">{PLAYER_NAMES[i]}</span>
            </div>
            <div className="info">
              {types[i]} · Captures: {captures[i] || 0}
            </div>
          </div>
        )
      })}
    </div>
  )
}

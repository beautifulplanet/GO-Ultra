type Props = {
  text: string
  subtitle?: string
}

export function GameOverlay({ text, subtitle }: Props) {
  return (
    <div className="game-overlay">
      {text}
      {subtitle && <div className="subtitle">{subtitle}</div>}
    </div>
  )
}

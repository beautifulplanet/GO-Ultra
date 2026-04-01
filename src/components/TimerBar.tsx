type Props = {
  timeLeft: number
  totalTime: number
  playerColor: string
}

export function TimerBar({ timeLeft, totalTime, playerColor }: Props) {
  if (totalTime <= 0) return null
  const pct = (timeLeft / totalTime) * 100
  const isLow = timeLeft <= 5

  return (
    <>
      <div className="timer-label">{timeLeft}s</div>
      <div className="timer-bar-container">
        <div
          className={`timer-bar-fill ${isLow ? 'pulse' : ''}`}
          style={{
            width: `${pct}%`,
            backgroundColor: isLow ? '#ff4444' : playerColor,
          }}
        />
      </div>
    </>
  )
}

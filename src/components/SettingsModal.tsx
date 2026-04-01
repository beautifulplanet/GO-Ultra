type Props = {
  onClose: () => void
  showValidMoves: boolean
  setShowValidMoves: (v: boolean) => void
  showTerritory: boolean
  setShowTerritory: (v: boolean) => void
  allowSuicide: boolean
  setAllowSuicide: (v: boolean) => void
  onNewGame: () => void
  onBackToLobby: () => void
}

export function SettingsModal(props: Props) {
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal frosted" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Settings</span>
          <button className="modal-close" onClick={props.onClose}>✕</button>
        </div>

        <div className="setting-row">
          <span>Show valid moves</span>
          <button
            className={`toggle ${props.showValidMoves ? 'on' : ''}`}
            onClick={() => props.setShowValidMoves(!props.showValidMoves)}
          >
            {props.showValidMoves ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="setting-row">
          <span>Show territory</span>
          <button
            className={`toggle ${props.showTerritory ? 'on' : ''}`}
            onClick={() => props.setShowTerritory(!props.showTerritory)}
          >
            {props.showTerritory ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="setting-row">
          <span>Allow suicide</span>
          <button
            className={`toggle ${props.allowSuicide ? 'on' : ''}`}
            onClick={() => props.setAllowSuicide(!props.allowSuicide)}
          >
            {props.allowSuicide ? 'ON' : 'OFF'}
          </button>
        </div>

        <button className="btn" onClick={props.onNewGame} style={{ marginTop: 16 }}>
          New Game
        </button>
        <button className="btn" onClick={props.onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  )
}

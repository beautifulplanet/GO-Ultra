// ai.worker.ts — Web Worker for MCTS AI computation
// Runs WASM AI off the main thread so the UI stays responsive.

import init, { GoGame } from 'go-engine'

let wasmReady = false

init().then(() => {
  wasmReady = true
  self.postMessage({ type: 'ready' })
})

self.onmessage = (e: MessageEvent) => {
  const { type, state, iterations } = e.data

  if (type === 'compute') {
    if (!wasmReady) {
      self.postMessage({ type: 'error', error: 'WASM not ready' })
      return
    }

    // Reconstruct game state from serialized bytes
    const game = GoGame.deserialize(new Uint8Array(state))
    const move = game.ai_move(iterations)

    self.postMessage({ type: 'result', move })
    game.free() // free WASM memory
  }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import init, { GoGame } from 'go-engine'
import AiWorker from './ai.worker?worker'

export type GameState = {
  board: Uint8Array
  turn: number
  scores: Float32Array
  captures: [number, number]
  ko: number
  moveCount: number
  isGameOver: boolean
  legalMoves: Set<number>
  size: number
}

export function useGoEngine(boardSize: number, players: number) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<GameState | null>(null)
  const gameRef = useRef<GoGame | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const aiCallbackRef = useRef<(() => void) | null>(null)

  // Initialize WASM + create game + start worker
  useEffect(() => {
    let cancelled = false
    init().then(() => {
      if (cancelled) return
      const game = new GoGame(boardSize, players)
      gameRef.current = game
      setReady(true)
      syncState(game)
    })

    // Start AI worker
    const worker = new AiWorker()
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        const game = gameRef.current
        if (!game) return
        const move = e.data.move as number
        if (move === 65535) {
          game.pass_turn()
        } else {
          game.play(move)
        }
        syncState(game)
        if (aiCallbackRef.current) {
          aiCallbackRef.current()
          aiCallbackRef.current = null
        }
      }
    }
    workerRef.current = worker

    return () => {
      cancelled = true
      worker.terminate()
    }
  }, [boardSize, players])

  const syncState = useCallback((game: GoGame) => {
    const legalArr = game.legal_moves()
    const legalSet = new Set<number>()
    for (let i = 0; i < legalArr.length; i++) legalSet.add(legalArr[i])
    setState({
      board: game.board_state(),
      turn: game.turn(),
      scores: game.scores(),
      captures: [game.captures(0), game.captures(1)],
      ko: game.ko_point(),
      moveCount: game.move_count(),
      isGameOver: game.is_game_over(),
      legalMoves: legalSet,
      size: game.size(),
    })
  }, [])

  const play = useCallback((pos: number) => {
    const game = gameRef.current
    if (!game) return false
    const ok = game.play(pos)
    if (ok) syncState(game)
    return ok
  }, [syncState])

  const pass = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    game.pass_turn()
    syncState(game)
  }, [syncState])

  const aiMove = useCallback((iterations = 800, onComplete?: () => void) => {
    const game = gameRef.current
    const worker = workerRef.current
    if (!game || !worker) return

    // Serialize state and send to worker
    const state = game.serialize()
    aiCallbackRef.current = onComplete || null
    worker.postMessage({
      type: 'compute',
      state: state.buffer,
      iterations,
    }, [state.buffer])
  }, [])

  // Fallback sync AI move (for cases where worker isn't ready)
  const aiMoveSync = useCallback((iterations = 800) => {
    const game = gameRef.current
    if (!game) return null
    const pos = game.ai_move(iterations)
    if (pos === 65535) {
      game.pass_turn()
      syncState(game)
      return null
    }
    game.play(pos)
    syncState(game)
    return pos
  }, [syncState])

  const newGame = useCallback((size: number, p: number) => {
    const game = new GoGame(size, p)
    gameRef.current = game
    syncState(game)
  }, [syncState])

  const deadStones = useCallback(() => {
    const game = gameRef.current
    if (!game) return new Uint16Array()
    return game.dead_stones()
  }, [])

  return { ready, state, play, pass, aiMove, aiMoveSync, newGame, deadStones }
}

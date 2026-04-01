import { useState, useEffect, useCallback, useRef } from 'react'
import init, { GoGame } from 'go-engine'

export type GameState = {
  board: Uint8Array
  turn: number
  scores: Float32Array
  captures: number[]
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
  const initRef = useRef(false)

  // Initialize WASM + create game
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    init().then(() => {
      const game = new GoGame(boardSize, players)
      gameRef.current = game
      setReady(true)
      syncState(game, players)
    })
  }, [])

  const syncState = useCallback((game: GoGame, numPlayers: number) => {
    const legalArr = game.legal_moves()
    const legalSet = new Set<number>()
    for (let i = 0; i < legalArr.length; i++) legalSet.add(legalArr[i])
    const capturesArr: number[] = []
    for (let i = 0; i < numPlayers; i++) capturesArr.push(game.captures(i))
    setState({
      board: game.board_state(),
      turn: game.turn(),
      scores: game.scores(),
      captures: capturesArr,
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
    if (ok) syncState(game, game.players())
    return ok
  }, [syncState])

  const pass = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    game.pass_turn()
    syncState(game, game.players())
  }, [syncState])

  const aiMoveSync = useCallback((iterations = 800) => {
    const game = gameRef.current
    if (!game) return null
    const pos = game.ai_move(iterations)
    if (pos === 65535) {
      game.pass_turn()
    } else {
      game.play(pos)
    }
    syncState(game, game.players())
    return pos === 65535 ? null : pos
  }, [syncState])

  const newGame = useCallback((size: number, p: number) => {
    const game = new GoGame(size, p)
    gameRef.current = game
    syncState(game, p)
  }, [syncState])

  const deadStones = useCallback(() => {
    const game = gameRef.current
    if (!game) return new Uint16Array()
    return game.dead_stones()
  }, [])

  const setSuicide = useCallback((allowed: boolean) => {
    const game = gameRef.current
    if (!game) return
    game.set_suicide(allowed)
  }, [])

  return { ready, state, play, pass, aiMoveSync, newGame, deadStones, setSuicide }
}

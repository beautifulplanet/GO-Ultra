import { useRef, useEffect, useCallback } from 'react'
import type { GameState } from './useGoEngine'

type Props = {
  state: GameState
  onPlay: (pos: number) => void
  disabled?: boolean
}

const BOARD_BG = '#dcb35c'
const LINE_COLOR = '#1a1a1a'
const BLACK_STONE = '#111'
const WHITE_STONE = '#f0f0f0'
const CRIMSON_STONE = '#dc143c'
const STAR_RADIUS = 3

// Star point positions per board size
const STAR_POINTS: Record<number, [number, number][]> = {
  9: [[2,2],[2,6],[4,4],[6,2],[6,6]],
  13: [[3,3],[3,9],[6,6],[9,3],[9,9],[3,6],[6,3],[6,9],[9,6]],
  15: [[3,3],[3,11],[7,7],[11,3],[11,11],[3,7],[7,3],[7,11],[11,7]],
  17: [[3,3],[3,13],[8,8],[13,3],[13,13],[3,8],[8,3],[8,13],[13,8]],
  19: [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]],
}

export default function GoBoard({ state, onPlay, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { board, size, legalMoves, ko } = state

  const padding = 32
  const cellSize = Math.min(Math.floor((560 - 2 * padding) / (size - 1)), 40)
  const boardPx = cellSize * (size - 1) + 2 * padding
  const stoneR = Math.floor(cellSize * 0.44)

  const gridX = (col: number) => padding + col * cellSize
  const gridY = (row: number) => padding + row * cellSize

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = boardPx * dpr
    canvas.height = boardPx * dpr
    canvas.style.width = `${boardPx}px`
    canvas.style.height = `${boardPx}px`
    ctx.scale(dpr, dpr)

    // Board background
    ctx.fillStyle = BOARD_BG
    ctx.fillRect(0, 0, boardPx, boardPx)

    // Grid lines
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = 1
    for (let i = 0; i < size; i++) {
      ctx.beginPath()
      ctx.moveTo(gridX(i), gridY(0))
      ctx.lineTo(gridX(i), gridY(size - 1))
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(gridX(0), gridY(i))
      ctx.lineTo(gridX(size - 1), gridY(i))
      ctx.stroke()
    }

    // Star points
    const stars = STAR_POINTS[size] || []
    ctx.fillStyle = LINE_COLOR
    for (const [r, c] of stars) {
      ctx.beginPath()
      ctx.arc(gridX(c), gridY(r), STAR_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }

    // Stones
    for (let pos = 0; pos < board.length; pos++) {
      const val = board[pos]
      if (val === 255) continue
      const r = Math.floor(pos / size)
      const c = pos % size
      const x = gridX(c)
      const y = gridY(r)

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.arc(x + 2, y + 2, stoneR, 0, Math.PI * 2)
      ctx.fill()

      // Stone
      const colors = [BLACK_STONE, WHITE_STONE, CRIMSON_STONE]
      ctx.fillStyle = colors[val] || BLACK_STONE
      ctx.beginPath()
      ctx.arc(x, y, stoneR, 0, Math.PI * 2)
      ctx.fill()

      // Outline
      ctx.strokeStyle = val === 1 ? '#aaa' : '#000'
      ctx.lineWidth = 1
      ctx.stroke()

      // Highlight on white stones
      if (val === 1) {
        const grad = ctx.createRadialGradient(x - stoneR * 0.3, y - stoneR * 0.3, stoneR * 0.1, x, y, stoneR)
        grad.addColorStop(0, 'rgba(255,255,255,0.6)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, stoneR, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Ko marker
    if (ko !== 65535) {
      const kr = Math.floor(ko / size)
      const kc = ko % size
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 2
      const ks = stoneR * 0.5
      ctx.strokeRect(gridX(kc) - ks, gridY(kr) - ks, ks * 2, ks * 2)
    }

    // Last move marker (current turn just changed, so highlight the move before)
    // We skip this for now — can add move history later

    // Hover hint for legal moves is handled via onMouseMove
  }, [board, size, ko, boardPx, cellSize, stoneR])

  useEffect(() => { draw() }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Find nearest intersection
    const col = Math.round((mx - padding) / cellSize)
    const row = Math.round((my - padding) / cellSize)
    if (col < 0 || col >= size || row < 0 || row >= size) return
    const pos = row * size + col
    if (legalMoves.has(pos)) {
      onPlay(pos)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const col = Math.round((mx - padding) / cellSize)
    const row = Math.round((my - padding) / cellSize)
    if (col < 0 || col >= size || row < 0 || row >= size) {
      canvas.style.cursor = 'default'
      return
    }
    const pos = row * size + col
    canvas.style.cursor = legalMoves.has(pos) ? 'pointer' : 'default'
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      style={{ borderRadius: 4 }}
    />
  )
}

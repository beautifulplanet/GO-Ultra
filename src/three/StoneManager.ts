import * as THREE from 'three'
import gsap from 'gsap'
import type { BoardRenderer } from './BoardRenderer'
import type { QualityLevel } from './SceneManager'

// Player stone colors from CONSTRUCTION.md §2
const PLAYER_COLORS = [
  { color: 0x1a1a1a, emissive: 0x333333, roughness: 0.15 }, // Obsidian
  { color: 0xf0ead6, emissive: 0xfffbe8, roughness: 0.12 }, // Ivory
  { color: 0x8b1a1a, emissive: 0xc0392b, roughness: 0.2 },  // Crimson
]

export class StoneManager {
  private board: BoardRenderer
  private stoneMeshes: Map<number, THREE.Mesh> = new Map()
  private stoneGeo: THREE.SphereGeometry
  private materials: THREE.MeshStandardMaterial[] = []

  constructor(_scene: THREE.Scene, board: BoardRenderer, quality: QualityLevel) {
    this.board = board

    const segments = quality === 'high' ? 32 : quality === 'med' ? 16 : 8
    this.stoneGeo = new THREE.SphereGeometry(0.44, segments, segments)
    this.stoneGeo.scale(1, 0.72, 1) // flatten — authentic Go stone

    for (const pc of PLAYER_COLORS) {
      const mat = new THREE.MeshStandardMaterial({
        color: pc.color,
        roughness: pc.roughness,
        metalness: 0.0,
        emissive: pc.emissive,
        emissiveIntensity: 0.05,
        envMapIntensity: 0.8,
      })
      this.materials.push(mat)
    }
  }

  /** Place a stone with drop animation */
  placeStone(index: number, player: number, boardSize: number) {
    if (this.stoneMeshes.has(index)) return
    const mat = this.materials[player] || this.materials[0]
    const mesh = new THREE.Mesh(this.stoneGeo, mat)
    const pos = this.board.indexToWorld(index, boardSize)
    mesh.position.copy(pos)
    mesh.castShadow = true

    this.board.group.add(mesh)
    this.stoneMeshes.set(index, mesh)

    // Drop animation — stone falls from above with bounce
    gsap.from(mesh.position, {
      y: pos.y + 3,
      duration: 0.32,
      ease: 'bounce.out',
    })
    gsap.from(mesh.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.18,
      ease: 'back.out(1.5)',
    })
  }

  /** Remove captured stones with burst animation */
  removeStones(indices: number[], _boardSize?: number): Promise<void> {
    return new Promise((resolve) => {
      if (indices.length === 0) { resolve(); return }
      let completed = 0
      for (const idx of indices) {
        const mesh = this.stoneMeshes.get(idx)
        if (!mesh) { completed++; continue }
        this.stoneMeshes.delete(idx)

        // Flash white
        gsap.to((mesh.material as THREE.MeshStandardMaterial).emissive, {
          r: 1, g: 1, b: 1,
          duration: 0.08,
        })

        // Launch upward with random spread
        gsap.to(mesh.position, {
          y: mesh.position.y + 2,
          x: mesh.position.x + (Math.random() - 0.5) * 2,
          z: mesh.position.z + (Math.random() - 0.5) * 2,
          duration: 0.3,
          delay: 0.08,
          ease: 'power2.out',
        })

        // Spin
        gsap.to(mesh.rotation, {
          y: Math.PI * 2,
          duration: 0.4,
          delay: 0.08,
        })

        // Fade out and remove — do NOT dispose shared geometry/material
        const matClone = (mesh.material as THREE.MeshStandardMaterial).clone()
        matClone.transparent = true
        mesh.material = matClone
        gsap.to(matClone, {
          opacity: 0,
          duration: 0.2,
          delay: 0.3,
          onComplete: () => {
            this.board.group.remove(mesh)
            matClone.dispose() // only dispose the clone
            completed++
            if (completed >= indices.length) resolve()
          },
        })
      }
    })
  }

  /** Sync all stones from board state array */
  syncBoard(boardState: Uint8Array, boardSize: number) {
    // Track which positions should have stones
    const expected = new Set<number>()
    for (let i = 0; i < boardState.length; i++) {
      if (boardState[i] !== 255) {
        expected.add(i)
        if (!this.stoneMeshes.has(i)) {
          this.placeStone(i, boardState[i], boardSize)
        }
      }
    }
    // Remove stones that are no longer on the board
    const toRemove: number[] = []
    for (const [idx] of this.stoneMeshes) {
      if (!expected.has(idx)) toRemove.push(idx)
    }
    if (toRemove.length > 0) this.removeStones(toRemove, boardSize)
  }

  /** Pulse winner's stones emissive on game over */
  pulseWinner(boardState: Uint8Array, winner: number) {
    for (const [idx, mesh] of this.stoneMeshes) {
      if (boardState[idx] === winner) {
        const mat = mesh.material as THREE.MeshStandardMaterial
        gsap.to(mat, {
          emissiveIntensity: 0.5,
          duration: 0.4,
          yoyo: true,
          repeat: 2,
        })
      }
    }
  }

  clear() {
    for (const [, mesh] of this.stoneMeshes) {
      this.board.group.remove(mesh)
    }
    this.stoneMeshes.clear()
  }

  dispose() {
    this.clear()
    this.stoneGeo.dispose()
    this.materials.forEach(m => m.dispose())
  }
}

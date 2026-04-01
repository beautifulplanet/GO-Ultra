import * as THREE from 'three'
import type { QualityLevel } from './SceneManager'

// Star points (hoshi) per board size
const STAR_POINTS: Record<number, [number, number][]> = {
  9: [[2,2],[2,6],[4,4],[6,2],[6,6]],
  13: [[3,3],[3,9],[6,6],[9,3],[9,9],[3,6],[6,3],[6,9],[9,6]],
  15: [[3,3],[3,11],[7,7],[11,3],[11,11],[3,7],[7,3],[7,11],[11,7]],
  17: [[3,3],[3,13],[8,8],[13,3],[13,13],[3,8],[8,3],[8,13],[13,8]],
  19: [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]],
}

export class BoardRenderer {
  group: THREE.Group
  boardSize: number
  boardScale: number // world units per cell
  boardHalf: number  // half the board width in world units
  private meshes: THREE.Object3D[] = []

  constructor(scene: THREE.Scene, boardSize: number, _quality: QualityLevel) {
    this.group = new THREE.Group()
    this.group.rotation.x = -0.26 // ~15° tilt
    this.boardSize = boardSize
    this.boardScale = 0
    this.boardHalf = 0
    scene.add(this.group)
    this.build(boardSize)
  }

  private build(size: number) {
    this.boardSize = size
    // Scale the board to fit roughly 10 world units for 9×9, proportional for larger
    const totalWidth = 10 * (size / 9)
    this.boardScale = totalWidth / (size - 1)
    this.boardHalf = totalWidth / 2

    // Board surface — wood-colored plane
    const surfaceGeo = new THREE.PlaneGeometry(totalWidth + 1.2, totalWidth + 1.2)
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0xdcb35c,
      roughness: 0.7,
      metalness: 0.0,
    })
    const surface = new THREE.Mesh(surfaceGeo, surfaceMat)
    surface.rotation.x = -Math.PI / 2
    surface.position.y = 0
    surface.receiveShadow = true
    this.group.add(surface)
    this.meshes.push(surface)

    // Board frame — thin dark border
    const frameThick = 0.15
    const frameH = 0.4
    const fw = totalWidth + 1.2
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1a, roughness: 0.8 })
    const sides = [
      { pos: [0, -frameH / 2, -fw / 2], size: [fw + frameThick * 2, frameH, frameThick] },
      { pos: [0, -frameH / 2, fw / 2], size: [fw + frameThick * 2, frameH, frameThick] },
      { pos: [-fw / 2, -frameH / 2, 0], size: [frameThick, frameH, fw] },
      { pos: [fw / 2, -frameH / 2, 0], size: [frameThick, frameH, fw] },
    ]
    for (const s of sides) {
      const geo = new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2])
      const mesh = new THREE.Mesh(geo, frameMat)
      mesh.position.set(s.pos[0], s.pos[1], s.pos[2])
      this.group.add(mesh)
      this.meshes.push(mesh)
    }

    // Grid lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a, linewidth: 1 })
    const linePoints: THREE.Vector3[] = []
    for (let i = 0; i < size; i++) {
      const p = -this.boardHalf + i * this.boardScale
      // Vertical
      linePoints.push(new THREE.Vector3(p, 0.005, -this.boardHalf))
      linePoints.push(new THREE.Vector3(p, 0.005, this.boardHalf))
      // Horizontal
      linePoints.push(new THREE.Vector3(-this.boardHalf, 0.005, p))
      linePoints.push(new THREE.Vector3(this.boardHalf, 0.005, p))
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    this.group.add(lines)
    this.meshes.push(lines)

    // Star points
    const stars = STAR_POINTS[size] || []
    const starMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
    for (const [r, c] of stars) {
      const starGeo = new THREE.SphereGeometry(0.08, 8, 8)
      const star = new THREE.Mesh(starGeo, starMat)
      const pos = this.indexToWorld(r * size + c, size)
      star.position.set(pos.x, 0.02, pos.z)
      this.group.add(star)
      this.meshes.push(star)
    }

    // Shadow plane below board
    const shadowGeo = new THREE.PlaneGeometry(totalWidth + 4, totalWidth + 4)
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.3 })
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat)
    shadowPlane.rotation.x = -Math.PI / 2
    shadowPlane.position.y = -0.5
    shadowPlane.receiveShadow = true
    this.group.add(shadowPlane)
    this.meshes.push(shadowPlane)
  }

  /** Convert board index (row*size+col) to world position on the board surface */
  indexToWorld(index: number, size?: number): THREE.Vector3 {
    const s = size || this.boardSize
    const row = Math.floor(index / s)
    const col = index % s
    const x = -this.boardHalf + col * this.boardScale
    const z = -this.boardHalf + row * this.boardScale
    return new THREE.Vector3(x, 0.22, z) // stone sits on surface
  }

  rebuild(size: number) {
    // Remove old meshes
    for (const m of this.meshes) {
      this.group.remove(m)
      if (m instanceof THREE.Mesh || m instanceof THREE.LineSegments) {
        m.geometry.dispose()
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => mat.dispose())
        } else {
          (m.material as THREE.Material).dispose()
        }
      }
    }
    this.meshes = []
    this.build(size)
  }

  dispose() {
    this.rebuild(0) // clears all
  }
}

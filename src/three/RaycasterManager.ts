import * as THREE from 'three'
import type { BoardRenderer } from './BoardRenderer'

export class RaycasterManager {
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private camera: THREE.PerspectiveCamera
  private hitboxes: THREE.Mesh[] = []
  private hitboxGroup: THREE.Group
  private hitMaterial: THREE.MeshBasicMaterial
  board: BoardRenderer

  constructor(camera: THREE.PerspectiveCamera, board: BoardRenderer) {
    this.camera = camera
    this.board = board
    this.hitboxGroup = new THREE.Group()
    this.hitMaterial = new THREE.MeshBasicMaterial({ visible: false })
    board.group.add(this.hitboxGroup)
    this.buildHitboxes(board)
  }

  private buildHitboxes(board: BoardRenderer) {
    // Clear old — only dispose geometry, NOT the shared material
    for (const h of this.hitboxes) {
      this.hitboxGroup.remove(h)
      h.geometry.dispose()
    }
    this.hitboxes = []

    const size = board.boardSize
    const hitSize = board.boardScale * 0.9

    for (let i = 0; i < size * size; i++) {
      const pos = board.indexToWorld(i, size)
      const geo = new THREE.PlaneGeometry(hitSize, hitSize)
      const mesh = new THREE.Mesh(geo, this.hitMaterial)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(pos.x, 0.01, pos.z)
      mesh.userData.boardIndex = i
      this.hitboxGroup.add(mesh)
      this.hitboxes.push(mesh)
    }
  }

  rebuild(board: BoardRenderer) {
    this.board = board
    this.buildHitboxes(board)
  }

  /** Returns board index at screen position, or -1 */
  getIntersection(event: PointerEvent, canvas: HTMLCanvasElement): number {
    const rect = canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.hitboxes)
    if (intersects.length > 0) {
      return intersects[0].object.userData.boardIndex as number
    }
    return -1
  }

  /** Check if a position is legal and return cursor style */
  getCursor(event: PointerEvent, canvas: HTMLCanvasElement, legalMoves: Set<number>): string {
    const idx = this.getIntersection(event, canvas)
    if (idx >= 0 && legalMoves.has(idx)) return 'pointer'
    return 'default'
  }
}

import * as THREE from 'three'
import { SkyRenderer } from './SkyRenderer'
import { LightingManager } from './LightingManager'
import { BoardRenderer } from './BoardRenderer'
import { StoneManager } from './StoneManager'
import { RaycasterManager } from './RaycasterManager'
import { CameraController } from './CameraController'
import { ParticleSystem } from './ParticleSystem'

export type QualityLevel = 'low' | 'med' | 'high'

export class SceneManager {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sky: SkyRenderer
  lighting: LightingManager
  board: BoardRenderer
  stones: StoneManager
  raycaster: RaycasterManager
  cameraCtrl: CameraController
  particles: ParticleSystem
  private clock = new THREE.Clock()
  private animId = 0
  private container: HTMLElement

  constructor(container: HTMLElement, boardSize: number, quality: QualityLevel = 'high') {
    this.container = container
    const w = container.clientWidth
    const h = container.clientHeight

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = quality !== 'low'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    container.appendChild(this.renderer.domElement)

    // Scene
    this.scene = new THREE.Scene()

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    this.camera.position.set(0, 14, 18)
    this.camera.lookAt(0, 0, 0)

    // Sub-systems
    this.sky = new SkyRenderer(this.scene, quality)
    this.lighting = new LightingManager(this.scene, quality)
    this.board = new BoardRenderer(this.scene, boardSize, quality)
    this.stones = new StoneManager(this.scene, this.board, quality)
    this.raycaster = new RaycasterManager(this.camera, this.board)
    this.cameraCtrl = new CameraController(this.camera)
    this.particles = new ParticleSystem(this.scene, this.board)

    // Resize handler
    window.addEventListener('resize', this.handleResize)

    // Input handlers for camera idle reset
    container.addEventListener('pointerdown', this.handleInteraction)
    window.addEventListener('keydown', this.handleInteraction)
  }

  private handleResize = () => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private handleInteraction = () => {
    this.cameraCtrl.resetIdle()
  }

  start() {
    this.clock.start()
    const loop = () => {
      this.animId = requestAnimationFrame(loop)
      const dt = this.clock.getDelta()
      const t = this.clock.getElapsedTime()
      this.sky.update(t)
      this.cameraCtrl.update(dt)
      this.particles.update(dt)
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  stop() {
    cancelAnimationFrame(this.animId)
  }

  changeBoardSize(size: number) {
    this.board.rebuild(size)
    this.stones.clear()
    this.raycaster.rebuild(this.board)
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  dispose() {
    this.stop()
    window.removeEventListener('resize', this.handleResize)
    this.container.removeEventListener('pointerdown', this.handleInteraction)
    window.removeEventListener('keydown', this.handleInteraction)
    this.renderer.dispose()
    this.sky.dispose()
    this.board.dispose()
    this.stones.dispose()
    this.particles.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }
}

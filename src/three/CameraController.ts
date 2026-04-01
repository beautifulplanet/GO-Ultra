import * as THREE from 'three'
import gsap from 'gsap'

const DEFAULT_POS = new THREE.Vector3(0, 14, 18)
const ORBIT_RADIUS = 22
const IDLE_TIMEOUT = 4000

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private isOrbiting = false
  private orbitAngle = 0
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.startIdleTimer()
  }

  private startIdleTimer() {
    this.idleTimer = setTimeout(() => {
      this.isOrbiting = true
    }, IDLE_TIMEOUT)
  }

  resetIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    if (this.isOrbiting) {
      this.isOrbiting = false
      gsap.to(this.camera.position, {
        x: DEFAULT_POS.x,
        y: DEFAULT_POS.y,
        z: DEFAULT_POS.z,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => this.camera.lookAt(0, 0, 0),
      })
    }
    this.startIdleTimer()
  }

  /** Tween camera to bird's-eye view for game over */
  gameOverView() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.isOrbiting = false
    gsap.to(this.camera.position, {
      x: 0, y: 28, z: 5,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(0, 0, 0),
    })
  }

  /** Reset to default play position */
  resetToPlay() {
    gsap.to(this.camera.position, {
      x: DEFAULT_POS.x,
      y: DEFAULT_POS.y,
      z: DEFAULT_POS.z,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(0, 0, 0),
    })
    this.startIdleTimer()
  }

  update(_dt: number) {
    if (this.isOrbiting) {
      this.orbitAngle += 0.003
      this.camera.position.x = Math.sin(this.orbitAngle) * ORBIT_RADIUS
      this.camera.position.z = Math.cos(this.orbitAngle) * ORBIT_RADIUS
      this.camera.position.y = 14 + Math.sin(this.orbitAngle * 0.5) * 2
      this.camera.lookAt(0, 0, 0)
    }
  }
}

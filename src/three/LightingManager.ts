import * as THREE from 'three'
import type { QualityLevel } from './SceneManager'

export class LightingManager {
  ambient: THREE.AmbientLight
  directional: THREE.DirectionalLight
  point: THREE.PointLight
  private defaultDirColor = new THREE.Color(0xfff8f0)

  constructor(scene: THREE.Scene, quality: QualityLevel) {
    this.ambient = new THREE.AmbientLight(0xfff4e0, 0.6)
    scene.add(this.ambient)

    this.directional = new THREE.DirectionalLight(0xfff8f0, 1.2)
    this.directional.position.set(8, 15, 5)
    if (quality !== 'low') {
      this.directional.castShadow = true
      this.directional.shadow.mapSize.set(1024, 1024)
      this.directional.shadow.camera.near = 0.5
      this.directional.shadow.camera.far = 40
      this.directional.shadow.camera.left = -12
      this.directional.shadow.camera.right = 12
      this.directional.shadow.camera.top = 12
      this.directional.shadow.camera.bottom = -12
    }
    scene.add(this.directional)

    this.point = new THREE.PointLight(0xff9944, 0.4, 30)
    this.point.position.set(0, -3, 0)
    scene.add(this.point)
  }

  /** Pulse directional light to player color on turn change */
  pulseToColor(color: THREE.Color) {
    const gsap = (window as any).__gsap
    if (!gsap) return
    gsap.to(this.directional.color, {
      r: color.r, g: color.g, b: color.b,
      duration: 0.35,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.directional.color, {
          r: this.defaultDirColor.r,
          g: this.defaultDirColor.g,
          b: this.defaultDirColor.b,
          duration: 0.35,
        })
      },
    })
  }
}

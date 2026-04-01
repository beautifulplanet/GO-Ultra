import * as THREE from 'three'
import gsap from 'gsap'
import type { BoardRenderer } from './BoardRenderer'

export class ParticleSystem {
  private board: BoardRenderer
  private activeParticles: THREE.Points[] = []

  constructor(_scene: THREE.Scene, board: BoardRenderer) {
    this.board = board
  }

  /** Dust ring when a stone is placed */
  dustRing(index: number, boardSize: number) {
    const pos = this.board.indexToWorld(index, boardSize)
    const count = 8
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      positions[i * 3] = pos.x + Math.cos(angle) * 0.1
      positions[i * 3 + 1] = 0.05
      positions[i * 3 + 2] = pos.z + Math.sin(angle) * 0.1
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

    const mat = new THREE.PointsMaterial({
      color: 0xdcb35c,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    this.board.group.add(points)
    this.activeParticles.push(points)

    // Expand outward and fade
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const obj = { t: 0 }
    gsap.to(obj, {
      t: 1,
      duration: 0.15,
      onUpdate: () => {
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2
          const r = 0.1 + obj.t * 0.5
          posAttr.setXYZ(
            i,
            pos.x + Math.cos(angle) * r,
            0.05,
            pos.z + Math.sin(angle) * r
          )
        }
        posAttr.needsUpdate = true
        mat.opacity = 0.8 * (1 - obj.t)
      },
      onComplete: () => {
        this.board.group.remove(points)
        geo.dispose()
        mat.dispose()
        const idx = this.activeParticles.indexOf(points)
        if (idx >= 0) this.activeParticles.splice(idx, 1)
      },
    })
  }

  /** Confetti burst for game over */
  confetti() {
    const count = 200
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const velocities: THREE.Vector3[] = []

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2
      positions[i * 3 + 1] = 0.5
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2
      const c = new THREE.Color().setHSL(Math.random(), 0.8, 0.6)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        5 + Math.random() * 10,
        (Math.random() - 0.5) * 8
      ))
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    this.board.group.add(points)
    this.activeParticles.push(points)

    // Animate with gravity
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    let elapsed = 0
    const gravity = -15
    const ticker = { t: 0 }
    gsap.to(ticker, {
      t: 1,
      duration: 2.5,
      onUpdate: () => {
        const dt = ticker.t * 2.5 - elapsed
        elapsed = ticker.t * 2.5
        for (let i = 0; i < count; i++) {
          velocities[i].y += gravity * dt
          posAttr.setXYZ(
            i,
            posAttr.getX(i) + velocities[i].x * dt,
            posAttr.getY(i) + velocities[i].y * dt,
            posAttr.getZ(i) + velocities[i].z * dt
          )
        }
        posAttr.needsUpdate = true
        mat.opacity = 1 - ticker.t * 0.6
      },
      onComplete: () => {
        this.board.group.remove(points)
        geo.dispose()
        mat.dispose()
        const idx = this.activeParticles.indexOf(points)
        if (idx >= 0) this.activeParticles.splice(idx, 1)
      },
    })
  }

  update(_dt: number) {
    // Particle updates handled by GSAP tweens
  }

  dispose() {
    for (const p of this.activeParticles) {
      this.board.group.remove(p)
      p.geometry.dispose()
      ;(p.material as THREE.Material).dispose()
    }
    this.activeParticles = []
  }
}

import * as THREE from 'three'
import type { QualityLevel } from './SceneManager'

export class SkyRenderer {
  private dome: THREE.Mesh
  private cloudLayers: THREE.Group[] = []
  private sun: THREE.Mesh

  constructor(scene: THREE.Scene, quality: QualityLevel) {

    // Sky dome — inverted sphere with gradient shader
    const skyGeo = new THREE.SphereGeometry(500, 32, 16)
    skyGeo.scale(-1, 1, 1)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1a6bbd) },
        horizonColor: { value: new THREE.Color(0xf4a460) },
        lowColor: { value: new THREE.Color(0xff7043) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 lowColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 sky = mix(horizonColor, topColor, max(0.0, h));
          sky = mix(lowColor, sky, max(0.0, h + 0.1));
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
    this.dome = new THREE.Mesh(skyGeo, skyMat)
    scene.add(this.dome)

    // Sun
    const sunGeo = new THREE.SphereGeometry(1.2, 16, 16)
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88 })
    this.sun = new THREE.Mesh(sunGeo, sunMat)
    this.sun.position.set(80, 120, -200)
    scene.add(this.sun)

    // Clouds — billboard quads on rotating layers
    if (quality !== 'low') {
      const cloudCounts = quality === 'high' ? [8, 12, 16] : [6]
      const cloudRadii = quality === 'high' ? [80, 120, 160] : [100]

      cloudCounts.forEach((count, i) => {
        const layer = new THREE.Group()
        const radius = cloudRadii[i]
        for (let j = 0; j < count; j++) {
          const angle = (j / count) * Math.PI * 2 + Math.random() * 0.5
          const y = 40 + Math.random() * 30
          const cloudGeo = new THREE.PlaneGeometry(
            15 + Math.random() * 20,
            6 + Math.random() * 8
          )
          const cloudMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35 + Math.random() * 0.2,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          const cloud = new THREE.Mesh(cloudGeo, cloudMat)
          cloud.position.set(
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius
          )
          cloud.lookAt(0, y, 0)
          layer.add(cloud)
        }
        this.cloudLayers.push(layer)
        scene.add(layer)
      })
    }

    // Distant mountains — low-poly silhouette
    this.buildMountains(scene)
  }

  private buildMountains(scene: THREE.Scene) {
    const points: number[] = []
    const segments = 40
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const r = 300
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const peak = 5 + Math.random() * 15
      // Bottom vertex
      points.push(x, -2, z)
      // Top vertex
      points.push(x, peak, z)
    }
    const geo = new THREE.BufferGeometry()
    const indices: number[] = []
    for (let i = 0; i < segments; i++) {
      const bl = i * 2
      const tl = i * 2 + 1
      const br = (i + 1) * 2
      const tr = (i + 1) * 2 + 1
      indices.push(bl, br, tl)
      indices.push(tl, br, tr)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4a3f5c,
      side: THREE.DoubleSide,
    })
    const mountains = new THREE.Mesh(geo, mat)
    scene.add(mountains)
  }

  update(time: number) {
    const speeds = [0.00008, 0.00005, 0.00003]
    this.cloudLayers.forEach((layer, i) => {
      layer.rotation.y = time * speeds[i] * 60
    })
  }

  dispose() {
    this.dome.geometry.dispose()
    ;(this.dome.material as THREE.Material).dispose()
    this.sun.geometry.dispose()
    ;(this.sun.material as THREE.Material).dispose()
  }
}

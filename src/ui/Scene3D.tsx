/* eslint-disable react-hooks/immutability -- R3F: cập nhật đối tượng three trong useFrame là cách dùng chuẩn */
/**
 * Cảnh 3D low-poly (M3): mỗi địa điểm một cảnh riêng, nước bằng shader, trời theo giờ thật,
 * sinh vật ghé qua, camera tự lại gần phao khi cá rỉa. Toàn bộ hình dựng bằng khối cơ bản của three
 * (không dùng tài nguyên ngoài), nên ASSETS.md vẫn trống.
 */
import { Sky, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { type Creature, CREATURES } from '../content'
import { floatPose } from '../game/pose'
import { type Quality, useGame } from '../game/store'
import { waitStatus } from '../sim/game'
import { createRng, type Rng } from '../sim/rng'
import { localHour } from '../sim/world'

const SEG = 0.06 // m mỗi nấc, phóng to so với thật để nhìn rõ từ bờ
const ROD_TIP = new THREE.Vector3(0.35, 2.3, -2.8)
type Theme = 'fee_pond' | 'river' | 'mountain'

const THEME = {
  fee_pond: { deep: '#1f5a6b', shallow: '#3f8a8f', ground: '#6f8f4e', fog: '#dfe9ee' },
  river: { deep: '#2f5a5a', shallow: '#5f8a7a', ground: '#6b8f45', fog: '#e6ead8' },
  mountain: { deep: '#123c52', shallow: '#2f6f86', ground: '#3f6b3a', fog: '#cfdbe0' },
} as const

const isNight = (h: number) => h < 5 || h >= 19

function sunPosition(hour: number): [number, number, number] {
  const a = ((hour - 6) / 12) * Math.PI // 6h mọc, 18h lặn
  return [Math.cos(a) * 100, Math.sin(a) * 60, -80]
}

// ---------------------------------------------------------------- nước

const waterVert = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 p = position;
    float a = p.x * 0.35 + uTime * 0.9 + p.y * 0.2;
    float b = p.y * 0.6 - uTime * (1.3 + uFlow);
    p.z += sin(a) * 0.05 + sin(b) * 0.03;
    vNormal = normalize(normalMatrix * vec3(-cos(a) * 0.0175, -cos(b) * 0.018, 1.0));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const waterFrag = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform float uNight;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal);
    float fres = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
    float depthMix = smoothstep(-2.0, -40.0, vWorld.z);
    vec3 col = mix(mix(uShallow, uDeep, depthMix), uSky, fres * 0.65);
    vec3 h = normalize(uSunDir + viewDir);
    col += vec3(1.0, 0.95, 0.8) * pow(max(dot(n, h), 0.0), 120.0) * 0.8 * (1.0 - uNight);
    col *= mix(1.0, 0.55, uNight);
    gl_FragColor = vec4(col, 1.0);
  }
`

function Water({ theme, hour, quality }: { theme: Theme; hour: number; quality: Quality }) {
  const t = THEME[theme]
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlow: { value: theme === 'river' ? 1 : 0 },
      uDeep: { value: new THREE.Color(t.deep) },
      uShallow: { value: new THREE.Color(t.shallow) },
      uSky: { value: new THREE.Color(isNight(hour) ? '#1b2c35' : t.fog) },
      uSunDir: { value: new THREE.Vector3(...sunPosition(hour)).normalize() },
      uNight: { value: isNight(hour) ? 1 : 0 },
    }),
    [t, theme, hour],
  )
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })
  const segs = quality === 'low' ? 24 : quality === 'medium' ? 64 : 128
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -25]}>
      <planeGeometry args={[160, 70, segs, segs / 2]} />
      <shaderMaterial vertexShader={waterVert} fragmentShader={waterFrag} uniforms={uniforms} />
    </mesh>
  )
}

// ---------------------------------------------------------------- cảnh vật theo địa điểm

function Tree({ x, z, h, kind, colour }: { x: number; z: number; h: number; kind: 'cone' | 'round' | 'bamboo'; colour: string }) {
  if (kind === 'bamboo') {
    return (
      <group position={[x, 0.4, z]}>
        {[-0.3, 0, 0.35, 0.15].map((dx, i) => (
          <mesh key={i} position={[dx, h / 2, (i % 2) * 0.3]} rotation={[0, 0, dx * 0.15]}>
            <cylinderGeometry args={[0.06, 0.08, h, 5]} />
            <meshStandardMaterial color={i % 2 ? '#7fa04a' : '#6b8f3a'} flatShading />
          </mesh>
        ))}
        <mesh position={[0, h, 0]}>
          <dodecahedronGeometry args={[h * 0.25, 0]} />
          <meshStandardMaterial color="#5f8a3a" flatShading />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[x, 0.4, z]}>
      <mesh position={[0, h * 0.2, 0]}>
        <cylinderGeometry args={[0.12, 0.18, h * 0.4, 5]} />
        <meshStandardMaterial color="#5b4630" flatShading />
      </mesh>
      <mesh position={[0, h * 0.6, 0]}>
        {kind === 'cone' ? <coneGeometry args={[h * 0.28, h * 0.8, 7]} /> : <icosahedronGeometry args={[h * 0.32, 0]} />}
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
    </group>
  )
}

function scatter(rng: Rng, n: number, f: (rng: Rng, i: number) => { x: number; z: number; h: number }) {
  return Array.from({ length: n }, (_, i) => f(rng, i))
}

function Scenery({ theme, quality, night }: { theme: Theme; quality: Quality; night: boolean }) {
  const t = THEME[theme]
  const density = quality === 'low' ? 0.5 : quality === 'medium' ? 1 : 1.6
  const items = useMemo(() => {
    const rng = createRng(theme.length * 977 + 3)
    return {
      far: scatter(rng, Math.round(26 * density), (r) => ({ x: (r() - 0.5) * 80, z: -31 - r() * 8, h: 3 + r() * 4 })),
      side: scatter(rng, Math.round(10 * density), (r, i) => ({ x: (i % 2 ? 1 : -1) * ((theme === 'river' ? 14 : 9) + r() * 10), z: -6 - r() * 22, h: 2.5 + r() * 3 })),
      lotus: scatter(rng, theme === 'fee_pond' ? 14 : 0, (r) => ({ x: -8 + r() * 5, z: -6 - r() * 8, h: 0.4 + r() * 0.4 })),
      reeds: scatter(rng, theme === 'river' ? Math.round(30 * density) : 0, (r, i) => ({ x: (i % 2 ? 1 : -1) * (4 + r() * 8), z: -1.5 - r() * 3, h: 0.6 + r() * 0.7 })),
      peaks: scatter(rng, theme === 'mountain' ? 7 : 0, (r, i) => ({ x: -70 + i * 22 + r() * 8, z: -60 - r() * 20, h: 25 + r() * 25 })),
      umbrellas: scatter(rng, theme === 'fee_pond' ? 6 : 0, (r, i) => ({ x: -20 + i * 8 + r(), z: -27.5, h: 2 })),
    }
  }, [theme, density])
  const kind: 'cone' | 'round' | 'bamboo' = theme === 'mountain' ? 'cone' : theme === 'river' ? 'bamboo' : 'round'
  return (
    <>
      <mesh position={[0, -0.2, 3]} receiveShadow>
        <boxGeometry args={[14, 0.8, 4]} />
        <meshStandardMaterial color={theme === 'fee_pond' ? '#9a968c' : t.ground} flatShading />
      </mesh>
      <mesh position={[0.9, 0.35, 1.4]} castShadow>
        <boxGeometry args={[0.45, 0.3, 0.35]} />
        <meshStandardMaterial color="#1D5C73" />
      </mesh>
      <mesh position={[0, 0.2, -34]} receiveShadow>
        <boxGeometry args={[110, 0.8, 12]} />
        <meshStandardMaterial color={t.ground} flatShading />
      </mesh>
      {items.far.map((p, i) => (
        <Tree key={`f${i}`} {...p} kind={kind} colour={i % 3 ? '#3F6B3A' : '#507d3f'} />
      ))}
      {items.side.map((p, i) => (
        <Tree key={`s${i}`} {...p} kind={kind} colour={i % 2 ? '#456f3c' : '#5a8243'} />
      ))}
      {items.lotus.map((p, i) => (
        <group key={`l${i}`} position={[p.x, 0.03, p.z]}>
          <mesh rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[p.h, 7]} />
            <meshStandardMaterial color="#4f8a46" side={THREE.DoubleSide} flatShading />
          </mesh>
          {i % 4 === 0 && (
            <mesh position={[0.1, 0.18, 0]}>
              <coneGeometry args={[0.12, 0.25, 6]} />
              <meshStandardMaterial color="#e89ab0" flatShading />
            </mesh>
          )}
        </group>
      ))}
      {items.reeds.map((p, i) => (
        <mesh key={`r${i}`} position={[p.x, p.h / 2, p.z]} rotation={[0.1, 0, (i % 5) * 0.06 - 0.12]}>
          <cylinderGeometry args={[0.01, 0.02, p.h, 3]} />
          <meshStandardMaterial color="#8a9a4a" />
        </mesh>
      ))}
      {items.peaks.map((p, i) => (
        <mesh key={`p${i}`} position={[p.x, p.h / 2 - 1, p.z]}>
          <coneGeometry args={[p.h * 0.7, p.h, 6]} />
          <meshStandardMaterial color={i % 2 ? '#5d7a66' : '#6f8a78'} flatShading />
        </mesh>
      ))}
      {items.umbrellas.map((p, i) => (
        <group key={`u${i}`} position={[p.x, 0.6, p.z]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 2, 4]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[1.1, 0.5, 8]} />
            <meshStandardMaterial color={['#2f7a8a', '#C2410C', '#3F6B3A', '#d9a441'][i % 4]} flatShading />
          </mesh>
          <mesh position={[0.6, 1.6, 0]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color="#d23a2a" emissive="#ff6a3a" emissiveIntensity={night ? 1.5 : 0} />
          </mesh>
        </group>
      ))}
      {theme === 'river' && (
        <group position={[6, 0.15, -1]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 0, -i * 0.9]}>
              <boxGeometry args={[1.4, 0.12, 0.8]} />
              <meshStandardMaterial color="#7a5b3a" flatShading />
            </mesh>
          ))}
        </group>
      )}
    </>
  )
}

// ---------------------------------------------------------------- phao, cần, dây, gợn nước

function Float() {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const last = useRef({ off: 0, ringAt: -10 })
  const colours = ['#C2410C', '#F2C94C', '#C2410C', '#1E2A2F']
  useFrame(({ clock }) => {
    const { game, now } = useGame.getState()
    const g = group.current
    if (!g) return
    const pose = floatPose(game, now)
    g.visible = pose.visible
    const d = game.cast?.distanceM ?? 7
    g.position.set(0.2, (2 - pose.sink) * SEG - 10 * SEG, -d)
    g.rotation.z = pose.tilt
    // phao động mạnh thì nổi một vòng gợn nước
    if (pose.visible && Math.abs(pose.sink - last.current.off) > 0.08 && clock.elapsedTime - last.current.ringAt > 0.6) last.current.ringAt = clock.elapsedTime
    last.current.off = pose.sink
    const r = ring.current
    if (r) {
      const age = clock.elapsedTime - last.current.ringAt
      r.visible = pose.visible && age < 1.2
      r.position.set(0.2, 0.02, -d)
      r.scale.setScalar(0.2 + age * 1.6)
      ;(r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - age * 0.5)
    }
  })
  return (
    <>
      <group ref={group}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[0, (9.5 - i) * SEG, 0]}>
            <cylinderGeometry args={[0.018, 0.018, SEG * 0.92, 8]} />
            <meshStandardMaterial color={colours[i % colours.length]} emissive={i < 2 ? colours[i] : '#000000'} emissiveIntensity={0.25} />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
    </>
  )
}

function RodAndLine() {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([ROD_TIP, new THREE.Vector3()])
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.7 }))
  }, [])
  const rod = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const { game, now } = useGame.getState()
    const pos = line.geometry.attributes.position as THREE.BufferAttribute
    line.visible = game.phase !== 'ready' && game.phase !== 'charging' && !(game.phase === 'result' && game.result?.kind !== 'landed')
    let end: THREE.Vector3
    if ((game.phase === 'fighting' || game.phase === 'landable') && game.fight) {
      const f = game.fight
      end = new THREE.Vector3(Math.sin(clock.elapsedTime * 1.3) * 1.2 * Math.min(1, f.distanceM / 6), -0.05, -f.distanceM)
    } else {
      const pose = floatPose(game, now)
      end = new THREE.Vector3(0.2, (2 - pose.sink) * SEG + 0.02, -(game.cast?.distanceM ?? 7))
    }
    pos.setXYZ(1, end.x, end.y, end.z)
    pos.needsUpdate = true
    if (rod.current) {
      const bend = game.phase === 'fighting' || game.phase === 'landable' ? Math.min(1.2, game.fight?.tension ?? 0) * 0.35 : 0
      const charge = game.phase === 'charging' && game.chargeStartedAt ? Math.min(1, (now - game.chargeStartedAt) / 1200) * 0.6 : 0
      rod.current.rotation.x = -1.05 + bend + charge
    }
  })
  return (
    <>
      <primitive object={line} />
      <mesh ref={rod} position={[0.35, 0.9, 0.4]} rotation={[-1.05, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.02, 3.6, 6]} />
        <meshStandardMaterial color="#5b4630" />
      </mesh>
    </>
  )
}

// ---------------------------------------------------------------- sinh vật ghé qua

type Look = { size: [number, number, number]; colour: string; wings?: [number, number]; wingColour?: string }
const LOOKS: Record<Exclude<Creature['visual'], 'firefly'>, Look> = {
  butterfly: { size: [0.02, 0.02, 0.08], colour: '#333333', wings: [0.12, 0.1], wingColour: '#F2C94C' },
  dragonfly: { size: [0.02, 0.02, 0.18], colour: '#c2410c', wings: [0.16, 0.04], wingColour: '#dfe9ee' },
  bird: { size: [0.15, 0.15, 0.5], colour: '#f4f4f4', wings: [0.6, 0.2], wingColour: '#ffffff' },
  kingfisher: { size: [0.08, 0.08, 0.2], colour: '#1f7fb5', wings: [0.18, 0.08], wingColour: '#2a9fd6' },
  duck: { size: [0.25, 0.2, 0.45], colour: '#6b5a3a' },
  buffalo: { size: [1.0, 0.9, 2.0], colour: '#3a3a3a' },
  deer: { size: [0.5, 0.7, 1.2], colour: '#8a5a32' },
  monkey: { size: [0.35, 0.45, 0.35], colour: '#7a5a3a' },
  frog: { size: [0.12, 0.08, 0.15], colour: '#4f8a3a' },
}

/** Mỗi kiểu sinh vật một quỹ đạo theo tiến độ lượt ghé (0..1). */
function Visitor({ creature, startedAt, untilMs }: { creature: Creature; startedAt: number; untilMs: number }) {
  const g = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const p = Math.min(1, (Date.now() - startedAt) / untilMs)
    const el = clock.elapsedTime
    const grp = g.current
    if (!grp) return
    const flap = creature.visual === 'duck' ? 0 : Math.sin(el * 18) * 0.9
    if (wingL.current) wingL.current.rotation.z = flap
    if (wingR.current) wingR.current.rotation.z = -flap
    const d = useGame.getState().game.cast?.distanceM ?? 7
    switch (creature.visual) {
      case 'butterfly':
      case 'dragonfly':
        grp.position.set(Math.sin(p * 6) * 2.5 + 0.5, 0.6 + Math.sin(el * 3) * 0.2 + p * 0.4, -2 - p * (d - 2))
        break
      case 'bird':
      case 'kingfisher':
        if (creature.visual === 'kingfisher' && p > 0.45 && p < 0.65) {
          const k = (p - 0.45) / 0.2
          grp.position.set(1.5, 3 * (1 - Math.sin(k * Math.PI)) - 0.2, -d + 1) // lao xuống bắt cá
        } else grp.position.set(-30 + p * 60, 6 + Math.sin(p * Math.PI) * 3, -14)
        grp.rotation.y = -Math.PI / 2
        break
      case 'duck':
        grp.position.set(-14 + p * 28, 0.05, -18)
        break
      case 'buffalo':
      case 'deer':
      case 'monkey': {
        const walkIn = Math.min(1, p / 0.3)
        const walkOut = p > 0.8 ? (p - 0.8) / 0.2 : 0
        grp.position.set(creature.visual === 'monkey' ? -10 : 12 - walkIn * 3 + walkOut * 3, 0.4, -27 + walkIn * 2 - walkOut * 2)
        grp.rotation.x = p > 0.35 && p < 0.75 ? 0.25 : 0 // cúi xuống uống nước
        break
      }
      case 'frog':
        grp.position.set(-2 + p * 3, 0.15 + Math.abs(Math.sin(el * 4)) * 0.3, 0.8 - p * 0.5)
        break
      case 'firefly':
        grp.children.forEach((c, i) => {
          c.position.set(Math.sin(el * 0.7 + i) * 6, 0.8 + Math.sin(el * 1.3 + i * 2) * 0.5, -3 - (i % 7) * 2)
          ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * Math.abs(Math.sin(el * 2 + i))
        })
        break
    }
  })
  if (creature.visual === 'firefly') {
    return (
      <group ref={g}>
        {Array.from({ length: 24 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.04, 6, 4]} />
            <meshBasicMaterial color="#e8ff7a" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    )
  }
  const b = LOOKS[creature.visual]
  return (
    <group ref={g}>
      <mesh>
        <boxGeometry args={b.size} />
        <meshStandardMaterial color={b.colour} flatShading />
      </mesh>
      {(creature.visual === 'buffalo' || creature.visual === 'deer') && (
        <mesh position={[0, b.size[1] * 0.3, -b.size[2] * 0.6]}>
          <boxGeometry args={[b.size[0] * 0.6, b.size[1] * 0.6, b.size[2] * 0.35]} />
          <meshStandardMaterial color={b.colour} flatShading />
        </mesh>
      )}
      {b.wings && (
        <>
          <mesh ref={wingL} position={[b.wings[0] / 2, 0, 0]}>
            <planeGeometry args={b.wings} />
            <meshStandardMaterial color={b.wingColour} side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
          <mesh ref={wingR} position={[-b.wings[0] / 2, 0, 0]}>
            <planeGeometry args={b.wings} />
            <meshStandardMaterial color={b.wingColour} side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Wildlife() {
  const visitor = useGame((s) => s.visitor)
  if (!visitor) return null
  const c = CREATURES.find((x) => x.id === visitor.creatureId)
  if (!c) return null
  return <Visitor key={`${visitor.creatureId}${visitor.at}`} creature={c} startedAt={visitor.at} untilMs={visitor.untilMs} />
}

// ---------------------------------------------------------------- camera

const SEAT = new THREE.Vector3(0.9, 1.55, 2.2)
const WIDE = new THREE.Vector3(0, 7, 9)

/** Ngồi câu; lúc cá rỉa thì ghé lại gần phao; góc rộng thì lùi xa và cao. Chuyển mượt bằng lerp. */
function CameraRig() {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 0.3, -7))
  useFrame((_, dt) => {
    const { game, now, prefs } = useGame.getState()
    const d = game.cast?.distanceM ?? 7
    const w = waitStatus(game, now)
    const close = !prefs.wide && (w === 'nibbling' || w === 'window')
    const target = prefs.wide ? WIDE : close ? new THREE.Vector3(0.5, 1.0, -d + 3.2) : SEAT
    const lookAt = prefs.wide ? new THREE.Vector3(0, 0, -16) : new THREE.Vector3(0.2, close ? 0.05 : 0.3, -d)
    const k = 1 - Math.exp(-dt * 2.2)
    camera.position.lerp(target, k)
    look.current.lerp(lookAt, k)
    camera.lookAt(look.current)
  })
  return null
}

// ---------------------------------------------------------------- cảnh

export function Scene3D() {
  const hour = useGame((s) => localHour(Math.floor(s.now / 600_000) * 600_000)) // đổi trời mỗi 10 phút
  const theme = useGame((s) => s.cfg.location.theme)
  const quality = useGame((s) => s.prefs.quality)
  const covered = useGame((s) => s.panel !== null || s.shiftOver || !s.session) // có bảng che: vẽ thưa lại
  const weather = useGame((s) => s.session?.weather.kind ?? 'sunny')
  const night = isNight(hour)
  const fogColour = night ? '#16242e' : THEME[theme].fog
  const fogFar = weather === 'fog' || (theme === 'mountain' && hour < 8) ? 45 : 120
  return (
    <Canvas
      className="scene"
      camera={{ position: SEAT.toArray(), fov: 50, near: 0.05, far: 500 }}
      dpr={quality === 'low' ? 1 : quality === 'medium' ? [1, 1.5] : [1, 2]}
      shadows={quality === 'high'}
      frameloop={covered ? 'demand' : 'always'}
      gl={{ antialias: quality !== 'low', powerPreference: quality === 'low' ? 'low-power' : 'default' }}
    >
      {night ? (
        <>
          <color attach="background" args={['#0b1620']} />
          <Stars radius={150} depth={40} count={quality === 'low' ? 800 : 2500} factor={4} fade />
          <mesh position={[-40, 35, -120]}>
            <sphereGeometry args={[4, 16, 12]} />
            <meshBasicMaterial color="#f3efd8" />
          </mesh>
          <pointLight position={[-40, 35, -60]} intensity={0.6} distance={400} decay={0} color="#c8d4ff" />
        </>
      ) : (
        <Sky sunPosition={sunPosition(hour)} turbidity={weather === 'cloudy' || weather === 'rain' ? 12 : 6} rayleigh={1.2} />
      )}
      <hemisphereLight args={[night ? '#4a5a80' : '#dfe9ee', '#3f6b3a', night ? 0.5 : 0.8]} />
      <directionalLight position={sunPosition(night ? 12 : hour)} intensity={night ? 0.25 : 1.6} castShadow={quality === 'high'} />
      <ambientLight intensity={night ? 0.15 : 0.35} />
      <fog attach="fog" args={[fogColour, 25, fogFar]} />
      <Water theme={theme} hour={hour} quality={quality} />
      <Scenery theme={theme} quality={quality} night={night} />
      <Float />
      <RodAndLine />
      <Wildlife />
      <CameraRig />
    </Canvas>
  )
}

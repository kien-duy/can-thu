import { Sky } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { floatPose } from '../game/pose'
import { useGame } from '../game/store'
import { createRng } from '../sim/rng'
import { localHour } from '../sim/world'

/* eslint-disable react-hooks/immutability -- R3F: cập nhật đối tượng three trong useFrame là cách dùng chuẩn */
/** Cảnh 3D dựng thô (M1): mặt nước, hai bờ, cây, phao, cần, dây. Đồ hoạ thật làm ở M3. */
const SEG = 0.06 // m mỗi nấc, phóng to so với thật để nhìn rõ từ bờ
const ROD_TIP = new THREE.Vector3(0.35, 2.3, -2.8)

function sunPosition(hour: number): [number, number, number] {
  const a = ((hour - 6) / 12) * Math.PI // 6h mọc, 18h lặn
  return [Math.cos(a) * 100, Math.sin(a) * 60, -80]
}

function Float() {
  const group = useRef<THREE.Group>(null)
  const colours = ['#C2410C', '#F2C94C', '#C2410C', '#1E2A2F']
  useFrame(() => {
    const { game, now } = useGame.getState()
    const g = group.current
    if (!g) return
    const pose = floatPose(game, now)
    g.visible = pose.visible
    const d = game.cast?.distanceM ?? 7
    g.position.set(0.2, (2 - pose.sink) * SEG - 10 * SEG, -d)
    g.rotation.z = pose.tilt
  })
  return (
    <group ref={group}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[0, (9.5 - i) * SEG, 0]}>
          <cylinderGeometry args={[0.018, 0.018, SEG * 0.92, 8]} />
          <meshStandardMaterial color={colours[i % colours.length]} />
        </mesh>
      ))}
    </group>
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
    const casted = game.phase !== 'ready' && game.phase !== 'charging' && !(game.phase === 'result' && game.result?.kind !== 'landed')
    line.visible = casted
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
      const bend = game.phase === 'fighting' || game.phase === 'landable' ? (game.fight?.tension ?? 0) * 0.35 : 0
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

function Banks() {
  const trees = useMemo(() => {
    const rng = createRng(20261126)
    return Array.from({ length: 28 }, () => ({
      x: (rng() - 0.5) * 70,
      z: -30 - rng() * 8,
      h: 3 + rng() * 4,
    }))
  }, [])
  return (
    <>
      <mesh position={[0, -0.2, 3]}>
        <boxGeometry args={[12, 0.8, 4]} />
        <meshStandardMaterial color="#8a7a5c" />
      </mesh>
      <mesh position={[0.9, 0.35, 1.4]}>
        <boxGeometry args={[0.4, 0.3, 0.4]} />
        <meshStandardMaterial color="#1D5C73" />
      </mesh>
      <mesh position={[0, 0.2, -33]}>
        <boxGeometry args={[90, 0.8, 10]} />
        <meshStandardMaterial color="#5f7d4a" />
      </mesh>
      {trees.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2 + 0.5, t.z]}>
          <coneGeometry args={[t.h * 0.28, t.h, 7]} />
          <meshStandardMaterial color={i % 3 ? '#3F6B3A' : '#4f7a3f'} flatShading />
        </mesh>
      ))}
    </>
  )
}

function Water() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]}>
      <planeGeometry args={[140, 60]} />
      <meshStandardMaterial color="#2b6f86" roughness={0.7} metalness={0} />
    </mesh>
  )
}

export function Scene3D() {
  const hour = useGame((s) => localHour(Math.floor(s.now / 600_000) * 600_000)) // đổi vị trí mặt trời mỗi 10 phút
  const visible = useGame((s) => s.handbookOpen) // vẫn vẽ phía sau bảng
  return (
    <Canvas
      className="scene"
      camera={{ position: [0.9, 1.55, 2.2], fov: 50, near: 0.05, far: 400 }}
      dpr={[1, 1.5]}
      frameloop={visible ? 'demand' : 'always'}
      onCreated={({ camera }) => camera.lookAt(0, 0.3, -7)}
    >
      <Sky sunPosition={sunPosition(hour)} turbidity={6} rayleigh={1.2} />
      <hemisphereLight args={['#dfe9ee', '#3f6b3a', 0.8]} />
      <directionalLight position={sunPosition(hour)} intensity={1.6} />
      <ambientLight intensity={0.35} />
      <fog attach="fog" args={['#dfe9ee', 30, 110]} />
      <Water />
      <Banks />
      <Float />
      <RodAndLine />
    </Canvas>
  )
}

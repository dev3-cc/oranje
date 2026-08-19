import { Float, Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group } from 'three'

import { OrangeModel } from './OrangeModel'

/**
 * La escena del loader: la naranja girando sobre su eje con una órbita de
 * partículas. Va en su PROPIO archivo para que `LoadingOranje` la cargue con
 * `React.lazy`: three.js no debe entrar al bundle inicial por culpa de un
 * spinner.
 */
function SpinningOrange(): ReactNode {
  const group = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 1.2
    group.current.rotation.x = Math.sin(group.current.rotation.y * 0.5) * 0.15
  })

  return (
    <Float speed={2} rotationIntensity={0} floatIntensity={0.8}>
      <group ref={group} scale={1.15}>
        <OrangeModel />
      </group>
    </Float>
  )
}

export default function LoadingOranjeScene(): ReactNode {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 4.2], fov: 45 }}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 3]} intensity={1.5} color="#FFF3E0" />
      <directionalLight position={[-5, -2, 2]} intensity={0.45} color="#FFB566" />
      <SpinningOrange />
      <Sparkles count={40} scale={[4, 3, 2]} size={2} speed={0.4} color="#FFD9B0" />
    </Canvas>
  )
}

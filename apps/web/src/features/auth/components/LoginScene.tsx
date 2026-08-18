import { Float, MeshDistortMaterial, Sparkles } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'

/**
 * Panel visual del login: NARANJAS 🍊 flotando sobre el degradado de marca —
 * el papel que en la maqueta de referencia juega la fotografía. Todo es
 * procedural (esfera + tallo + hoja): no hacen falta vectores ni texturas.
 *
 * Es decorativo: `aria-hidden` y sin interacción. `dpr` topado a 1.5 para no
 * castigar laptops sin GPU dedicada.
 */

interface OrangeProps {
  position: [number, number, number]
  scale: number
  floatSpeed: number
}

/**
 * Una naranja: esfera con una distorsión mínima (la cáscara no es perfecta),
 * rugosa como la piel de la fruta, con su tallo y una hoja.
 */
function Orange({ position, scale, floatSpeed }: OrangeProps): ReactNode {
  return (
    <Float speed={floatSpeed} rotationIntensity={0.45} floatIntensity={1.3}>
      <group position={position} scale={scale}>
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <MeshDistortMaterial color="#FF8000" distort={0.08} speed={1.4} roughness={0.55} />
        </mesh>
        {/* Tallo */}
        <mesh position={[0, 1.02, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.18, 8]} />
          <meshStandardMaterial color="#6B4A2B" roughness={0.9} />
        </mesh>
        {/* Hoja: esfera aplastada e inclinada */}
        <mesh position={[0.22, 1.08, 0]} rotation={[0.4, 0.2, -0.9]} scale={[0.34, 0.1, 0.16]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color="#4C8A3F" roughness={0.6} />
        </mesh>
      </group>
    </Float>
  )
}

export function LoginScene(): ReactNode {
  return (
    <div aria-hidden className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 3]} intensity={1.5} color="#FFF3E0" />
        <directionalLight position={[-5, -2, 2]} intensity={0.45} color="#FFB566" />

        <Orange position={[0.5, 0.3, 0]} scale={1.35} floatSpeed={1.5} />
        <Orange position={[-1.7, -1.15, 0.5]} scale={0.5} floatSpeed={2.2} />
        <Orange position={[1.9, -1.5, -0.5]} scale={0.34} floatSpeed={2.7} />

        <Sparkles count={70} scale={[7, 5, 3]} size={2.2} speed={0.35} color="#FFE8CF" />
      </Canvas>
    </div>
  )
}

import { Float, MeshDistortMaterial, Sparkles } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'

/**
 * Panel visual del login: la esfera naranja distorsionada flota sobre el
 * degradado de marca — el papel que en la maqueta de referencia juega la
 * fotografía. Es decorativo: `aria-hidden` y sin interacción.
 *
 * Ligero a propósito: una malla distorsionada, un anillo de partículas y luces
 * simples; `dpr` topado a 1.5 para no castigar laptops sin GPU dedicada.
 */
export function LoginScene(): ReactNode {
  return (
    <div aria-hidden className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} color="#FFF3E0" />
        <directionalLight position={[-5, -2, 2]} intensity={0.5} color="#FF8000" />

        <Float speed={1.6} rotationIntensity={0.6} floatIntensity={1.4}>
          <mesh position={[0.4, 0.35, 0]} scale={1.55}>
            <sphereGeometry args={[1, 64, 64]} />
            <MeshDistortMaterial
              color="#FF9A3D"
              distort={0.42}
              speed={2.2}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
        </Float>

        <Float speed={2.4} rotationIntensity={0.4} floatIntensity={2}>
          <mesh position={[-1.7, -1.2, 0.6]} scale={0.38}>
            <sphereGeometry args={[1, 32, 32]} />
            <MeshDistortMaterial color="#FFD9B0" distort={0.3} speed={3} roughness={0.4} />
          </mesh>
        </Float>

        <Sparkles count={70} scale={[7, 5, 3]} size={2.2} speed={0.35} color="#FFE8CF" />
      </Canvas>
    </div>
  )
}

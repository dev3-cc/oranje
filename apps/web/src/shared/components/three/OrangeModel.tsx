import { MeshDistortMaterial } from '@react-three/drei'
import type { ReactNode } from 'react'

/**
 * LA naranja de la marca: esfera con distorsión mínima (la cáscara no es
 * perfecta), rugosa como la piel de la fruta, con su tallo y una hoja. Todo
 * procedural — sin vectores ni texturas.
 *
 * Solo la malla: quien la monta decide su física (el login la deja empujar,
 * el loader la gira). Vive en `shared/` porque la usan dos features y §4
 * prohíbe que una importe de la otra.
 */
export function OrangeModel(): ReactNode {
  return (
    <>
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
    </>
  )
}

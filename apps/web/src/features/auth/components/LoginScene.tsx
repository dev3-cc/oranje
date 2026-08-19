import { Float, Sparkles, useCursor } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import { Group, Vector3 } from 'three'

import { OrangeModel } from '@/shared/components/three/OrangeModel'

/**
 * Panel visual del login: NARANJAS 🍊 flotando sobre el degradado de marca —
 * el papel que en la maqueta de referencia juega la fotografía. Todo es
 * procedural (esfera + tallo + hoja): no hacen falta vectores ni texturas.
 *
 * Las naranjas SE PUEDEN EMPUJAR: el clic les mete un impulso que sale del
 * punto donde se picó, y un resorte amortiguado las regresa a su sitio. Es
 * física a mano (integración en `useFrame`), no un motor: tres cuerpos que
 * vuelven solos a casa no ameritan cargar rapier al bundle.
 *
 * `dpr` topado a 1.5 para no castigar laptops sin GPU dedicada.
 */

interface OrangeProps {
  position: [number, number, number]
  scale: number
  floatSpeed: number
}

/** Rigidez y freno del resorte; el par que hace que el empujón se sienta vivo. */
const SPRING_STIFFNESS = 5
const SPRING_DAMPING = 2.4
const PUSH_STRENGTH = 5
const SPIN_DECAY = 1.6

/**
 * Una naranja: esfera con una distorsión mínima (la cáscara no es perfecta),
 * rugosa como la piel de la fruta, con su tallo y una hoja.
 */
function Orange({ position, scale, floatSpeed }: OrangeProps): ReactNode {
  const group = useRef<Group>(null)
  const offset = useRef(new Vector3())
  const velocity = useRef(new Vector3())
  const spin = useRef(new Vector3())
  const [isHovered, setIsHovered] = useState(false)
  useCursor(isHovered)

  useFrame((_, rawDelta) => {
    if (!group.current) return
    /** Con la pestaña en segundo plano, delta se dispara; se acota. */
    const delta = Math.min(rawDelta, 0.05)

    const acceleration = offset.current
      .clone()
      .multiplyScalar(-SPRING_STIFFNESS)
      .addScaledVector(velocity.current, -SPRING_DAMPING)
    velocity.current.addScaledVector(acceleration, delta)
    offset.current.addScaledVector(velocity.current, delta)

    group.current.position.set(
      position[0] + offset.current.x,
      position[1] + offset.current.y,
      position[2] + offset.current.z,
    )
    group.current.rotation.x += spin.current.x * delta
    group.current.rotation.y += spin.current.y * delta
    group.current.rotation.z += spin.current.z * delta
    spin.current.multiplyScalar(Math.max(0, 1 - SPIN_DECAY * delta))
  })

  function push(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation()
    if (!group.current) return
    /** El impulso sale del punto donde se picó, atravesando el centro. */
    const direction = group.current.getWorldPosition(new Vector3()).sub(event.point).normalize()
    /** Sin huir a fondo de cámara: el empujón vive casi todo en el plano. */
    direction.z *= 0.25
    velocity.current.addScaledVector(direction, PUSH_STRENGTH)
    spin.current.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
    )
  }

  return (
    <Float speed={floatSpeed} rotationIntensity={0.45} floatIntensity={1.3}>
      <group
        ref={group}
        position={position}
        scale={scale}
        onPointerDown={push}
        onPointerOver={() => {
          setIsHovered(true)
        }}
        onPointerOut={() => {
          setIsHovered(false)
        }}
      >
        <OrangeModel />
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

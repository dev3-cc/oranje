import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

import fotoSonrisa from '@/assets/login/con-logo/oranje-2-logo.png'
import fotoLaptop from '@/assets/login/con-logo/oranje-3-logo.png'
import fotoTablet from '@/assets/login/con-logo/oranje-logo.png'

/**
 * El collage del login: tres fotos del equipo Oranje (recortes con el logo en
 * la camisa, `assets/login/con-logo`) flotando sobre el mosaico, sin tarjetas, al modo de
 * las piezas de marca de las redes sociales que Hugo tomó de referencia —
 * solo imágenes, decisión suya. Es decorativo (`aria-hidden`), flota suave y
 * se queda quieto con `prefers-reduced-motion`.
 */
function Floating({
  children,
  delay = 0,
  amplitude = 8,
  className,
}: {
  children: ReactNode
  delay?: number
  amplitude?: number
  className?: string
}): ReactNode {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className={className}
      {...(reduceMotion
        ? {}
        : {
            animate: { y: [0, -amplitude, 0] },
            transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' as const, delay },
          })}
    >
      {children}
    </motion.div>
  )
}

export function LoginCollage(): ReactNode {
  return (
    <div aria-hidden className="absolute inset-0">
      {/* Un solo racimo: la grande atrás, las chicas encimadas al frente (referencia de Facebook). */}
      <Floating className="absolute top-[4%] right-[0%] z-0 h-[58%]" delay={0.2}>
        <img
          src={fotoTablet}
          alt=""
          className="h-full w-auto drop-shadow-[0_18px_28px_rgba(255,128,0,0.35)]"
        />
      </Floating>
      <Floating className="absolute top-[36%] left-[0%] z-10 h-[40%]" delay={1.1}>
        <img
          src={fotoSonrisa}
          alt=""
          className="h-full w-auto drop-shadow-[0_18px_28px_rgba(255,128,0,0.35)]"
        />
      </Floating>
      <Floating className="absolute top-[58%] left-[36%] z-20 h-[38%]" delay={0.6} amplitude={6}>
        <img
          src={fotoLaptop}
          alt=""
          className="h-full w-auto drop-shadow-[0_18px_28px_rgba(255,128,0,0.35)]"
        />
      </Floating>
    </div>
  )
}

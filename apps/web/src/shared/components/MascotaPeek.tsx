import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { DotLottie } from '@lottiefiles/dotlottie-react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { useSidebar } from '@oranje/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import personajeUrl from '@/assets/mascota/sidebar.json?url'
import { MOTION } from '@/shared/lib/motion'

/** Consejos cortos sobre cosas que la app de verdad hace. */
const CONSEJOS: MessageDescriptor[] = [
  msg`Con Ctrl/⌘ K abres la búsqueda desde cualquier pantalla.`,
  msg`El botón del menú (☰) en el encabezado esconde el panel y te da más espacio.`,
  msg`Cambia el idioma desde tu tarjeta de perfil, abajo del menú.`,
  msg`En una vista de detalle, la flecha ← te regresa a donde estabas.`,
  msg`Si tu sesión caduca, al volver a entrar retomas en la misma pantalla.`,
  msg`Cuando salga una versión nueva te avisamos con un mensaje: recarga y listo.`,
]

/** Primer saludo poco después de entrar; luego cada tanto para no cansar. */
const PRIMER_SALUDO_MS = 2500
const REPETIR_CADA_MS = 90_000
const DURACION_SALUDO_MS = 7000

/**
 * Geometría del lienzo: el Lottie es 1500×1500 con MUCHO aire; el personaje
 * (sin el letrero) ocupa x 40 %–75 % y y 10 %–91 %. Espejeado queda en
 * x 25 %–60 %. El contenedor animado mide exactamente lo que el personaje, y
 * el lienzo se desplaza para que coincidan — así "-40 %" es 40 % DEL PERSONAJE.
 */
const LIENZO_PX = 288
const PERSONAJE = {
  width: Math.round(LIENZO_PX * 0.36),
  height: Math.round(LIENZO_PX * 0.81),
  left: -Math.round(LIENZO_PX * 0.25),
  top: -Math.round(LIENZO_PX * 0.1),
}

/**
 * El personaje (Lottie de LottieFiles, `sidebar.json`: el letrero en blanco
 * que sostenía va oculto en el propio JSON) se asoma por DETRÁS del sidebar:
 * primero la mano levantada y la cara, suelta un consejo y se vuelve a
 * esconder. Vive fijo en el borde derecho del panel (`--sb`) con z-index
 * menor al del sidebar, así el vidrio del panel lo tapa y difumina al
 * entrar y salir. Va espejeado para que la mano levantada mire al contenido.
 * El Lottie solo corre mientras está asomado. Decorativo: no bloquea clics y
 * solo en escritorio (≥ lg), y no aparece con `prefers-reduced-motion` ni con
 * el panel colapsado.
 */
export function MascotaPeek(): ReactNode {
  const { i18n } = useLingui()
  const reduceMotion = useReducedMotion()
  const { state, isMobile } = useSidebar()
  const [asomada, setAsomada] = useState(false)
  const [consejo, setConsejo] = useState(0)
  const [lottie, setLottie] = useState<DotLottie | null>(null)

  const activa = !reduceMotion && !isMobile && state === 'expanded'

  useEffect(() => {
    if (!activa) return
    let esconder = 0
    const asomar = () => {
      /* En una pestaña de fondo los timers corren pero la animación no: mejor
         no gastar el saludo ahí. */
      if (document.hidden) return
      setConsejo((actual) => (actual + 1) % CONSEJOS.length)
      setAsomada(true)
      esconder = window.setTimeout(() => {
        setAsomada(false)
      }, DURACION_SALUDO_MS)
    }
    const primero = window.setTimeout(asomar, PRIMER_SALUDO_MS)
    const repetir = window.setInterval(asomar, REPETIR_CADA_MS)
    return () => {
      window.clearTimeout(primero)
      window.clearInterval(repetir)
      window.clearTimeout(esconder)
      setAsomada(false)
    }
  }, [activa])

  /* El personaje se mueve solo mientras está a la vista. */
  useEffect(() => {
    if (!lottie) return
    if (asomada) {
      lottie.setFrame(0)
      lottie.play()
    } else {
      lottie.pause()
    }
  }, [lottie, asomada])

  if (!activa) return null

  const consejoActual = CONSEJOS[consejo]

  return (
    <div
      data-testid="mascota-peek"
      className="pointer-events-none fixed bottom-16 left-(--sb) z-[5] hidden lg:block"
    >
      {/* Pivote abajo a la izquierda: al girar en sentido horario la cabeza
          se ladea hacia afuera del panel, como quien se asoma tras una pared. */}
      <motion.div
        aria-hidden
        className="relative origin-bottom-left"
        style={{ width: PERSONAJE.width, height: PERSONAJE.height }}
        initial={false}
        animate={
          asomada ? { x: '-38%', rotate: 14, opacity: 1 } : { x: '-110%', rotate: 0, opacity: 0 }
        }
        transition={
          asomada
            ? { type: 'spring', stiffness: 220, damping: 17, opacity: { duration: 0.2 } }
            : { duration: MOTION.enter, ease: [...MOTION.easeIn] }
        }
      >
        <div
          className="absolute -scale-x-100"
          style={{
            width: LIENZO_PX,
            height: LIENZO_PX,
            left: PERSONAJE.left,
            top: PERSONAJE.top,
          }}
        >
          <DotLottieReact
            src={personajeUrl}
            loop
            autoplay={false}
            dotLottieRefCallback={setLottie}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {asomada && (
          <motion.p
            key={consejo}
            className="absolute top-0 left-32 w-56 rounded-xl border border-line bg-surface px-3 py-2 text-xs leading-snug text-ink shadow-md before:absolute before:top-4 before:right-full before:border-8 before:border-transparent before:border-r-surface before:content-['']"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: { duration: MOTION.exit } }}
            transition={{ duration: MOTION.enter, delay: 0.35, ease: [...MOTION.easeOut] }}
          >
            <span className="mb-0.5 block text-[10px] font-semibold tracking-wide text-o-700 uppercase">
              {i18n._(msg`Consejo`)}
            </span>
            {consejoActual && i18n._(consejoActual)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

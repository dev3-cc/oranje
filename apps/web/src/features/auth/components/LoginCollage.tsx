import { useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

import mascotaCelebrando from '@/assets/mascota/mascota-celebrando.png'
import mascotaFeliz from '@/assets/mascota/mascota-feliz.png'
import personaColaboradora from '@/assets/personas/persona-colaborador-mujer.svg'
import personaHotel from '@/assets/personas/persona-hotel-senalando.svg'
import personaVentas from '@/assets/personas/persona-ventas-mujer.svg'

/**
 * Panel visual del login: un collage de tarjetas flotantes con el PERSONAL
 * ORANJE (los personajes con uniforme y logo del Sistema de Diseño), al modo
 * de las piezas de marca de las redes sociales que Hugo tomó de referencia.
 * Todo es material propio: nada de fotografías de terceros.
 *
 * Cada tarjeta es una escena del producto, no un adorno: el turno de hoy, una
 * requisición cubriéndose, un ponche registrado, la disponibilidad. Es
 * decorativo (`aria-hidden`), flota suave y se queda quieto con
 * `prefers-reduced-motion`.
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
  const { t } = useLingui()

  return (
    /* Deja libre la franja inferior donde vive la tarjeta de versión e idioma. */
    <div aria-hidden className="absolute inset-x-0 top-0 bottom-24 p-4">
      <div className="relative h-full w-full">
        {/* La historia: la persona del hotel señalando el turno de hoy. */}
        <Floating className="absolute top-[4%] right-[4%] h-[72%] w-[54%]" delay={0.2}>
          <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-gradient-to-b from-o-50 via-surface to-o-200/60 shadow-xl">
            <div className="absolute inset-x-5 top-4 flex gap-1.5">
              <span className="h-1 flex-1 rounded-full bg-o-500" />
              <span className="h-1 flex-1 rounded-full bg-o-500/30" />
              <span className="h-1 flex-1 rounded-full bg-o-500/30" />
            </div>
            <img
              src={personaHotel}
              alt=""
              className="absolute bottom-[10%] left-1/2 h-[78%] w-auto -translate-x-1/2 drop-shadow-lg"
            />
            <div className="absolute top-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-surface shadow-md">
              <MaterialIcon name="schedule" className="text-base" />
              {t`Turno 07:00 – 15:00`}
            </div>
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
              <span className="h-9 flex-1 rounded-full border-2 border-o-300/70 bg-surface/60" />
              <span className="size-9 rounded-full border-2 border-o-300/70 bg-surface/60" />
              <span className="size-9 rounded-full border-2 border-o-300/70 bg-surface/60" />
            </div>
          </div>
        </Floating>

        {/* La requisición cubriéndose. */}
        <Floating className="absolute top-[18%] left-[3%] w-[44%]" delay={1.1}>
          <div className="overflow-hidden rounded-2xl bg-surface shadow-xl">
            <div className="relative h-28 bg-gradient-to-br from-o-200 to-o-300">
              <span className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-lg bg-surface text-o-700 shadow-sm">
                <MaterialIcon name="assignment" className="text-lg" />
              </span>
              <img
                src={personaVentas}
                alt=""
                className="absolute right-3 bottom-0 h-[118%] w-auto drop-shadow"
              />
            </div>
            <div className="flex flex-col gap-2 px-4 py-3">
              <p className="text-xs font-semibold text-ink">Housekeeping</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full w-3/4 rounded-full bg-o-500" />
              </div>
              <p className="text-[11px] text-ink-3">{t`3 de 4 slots cubiertos`}</p>
            </div>
          </div>
        </Floating>

        {/* El ponche registrado. */}
        <Floating className="absolute top-[64%] left-[0%] w-[44%]" delay={2}>
          <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2.5 shadow-xl">
            <img src={mascotaFeliz} alt="" className="size-10 shrink-0 object-contain" />
            <div className="min-w-0 whitespace-nowrap">
              <p className="text-xs font-semibold text-ink">{t`Entrada registrada`}</p>
              <p className="text-[11px] text-ink-3">07:02 · Xcaret</p>
            </div>
            <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-green/15 text-green">
              <MaterialIcon name="check" className="text-base" />
            </span>
          </div>
        </Floating>

        {/* La colaboradora: el avatar con anillo del semáforo. */}
        <Floating className="absolute bottom-[-2%] left-[46%] size-[25%]" delay={0.6} amplitude={6}>
          <div className="relative size-full overflow-hidden rounded-full border-4 border-o-500 bg-o-50 shadow-xl">
            <img
              src={personaColaboradora}
              alt=""
              className="absolute top-[6%] left-1/2 h-[170%] w-auto -translate-x-1/2"
            />
          </div>
        </Floating>

        {/* Los remates: la mascota y la disponibilidad. */}
        <Floating className="absolute top-[7%] left-[8%] size-[15%]" delay={1.6} amplitude={10}>
          <img src={mascotaCelebrando} alt="" className="size-full object-contain drop-shadow-lg" />
        </Floating>
        <Floating className="absolute top-[70%] right-[-2%]" delay={0.9} amplitude={7}>
          <div className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-xl">
            <span className="size-2.5 rounded-full bg-green" />
            {t`Disponible`}
          </div>
        </Floating>
      </div>
    </div>
  )
}

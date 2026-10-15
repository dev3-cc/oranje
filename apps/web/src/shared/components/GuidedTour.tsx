import { useLingui } from '@lingui/react/macro'
import { driver } from 'driver.js'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

import { useIntroSeen } from '@/shared/hooks/useIntroSeen'

/**
 * ¿Se puede recordar que ya se vio?
 *
 * `useIntroSeen` es fail-open a propósito: sin storage, el intro se muestra.
 * Para un MODAL descartable está bien; para un recorrido que se apodera de la
 * pantalla, no — en un navegador con datos bloqueados, o en una ventana
 * privada, se abriría en CADA carga de la pantalla. Así que el arranque
 * automático es fail-closed: si no se puede recordar, no arranca solo, y
 * «Ver el recorrido» sigue estando ahí para quien lo quiera.
 */
function puedeRecordar(): boolean {
  try {
    const sonda = 'oranje-tour-probe'
    window.localStorage.setItem(sonda, '1')
    window.localStorage.removeItem(sonda)
    return true
  } catch {
    return false
  }
}

/** Un paso del recorrido: a qué apunta y qué dice. */
export interface TourStep {
  /** El `data-tour` del elemento al que apunta, sin corchetes. */
  anchor: string
  title: string
  description: string
}

interface Props {
  /** Clave de «ya lo vi», por pantalla. La misma que usa su «¿Cómo funciona?». */
  storageKey: string
  steps: readonly TourStep[]
  /** El personaje que acompaña al recorrido; ya existe en `assets/ilustrations`. */
  character: string
  /** Para reabrirlo desde un botón de la pantalla. */
  onReady?: (start: () => void) => void
  /** Falso mientras la pantalla carga: un tour sobre un esqueleto no apunta a nada. */
  isReady?: boolean
}

/**
 * Recorrido guiado sobre los controles REALES de una pantalla (driver.js).
 *
 * Se distingue de `OnboardingIntro`, que es un modal aparte y explica el
 * CONCEPTO: esto señala dónde se toca. Las dos cosas conviven —en Auditorías
 * ya está el modal— y a propósito no repiten el mismo texto.
 *
 * Tres cosas que lo hacen honesto:
 *
 * 1. **Los pasos que no están en pantalla se caen solos.** Los tres roles del
 *    hotel ven controles distintos —un Supervisor no autoriza, y «Crear
 *    requisición» no se le dibuja a quien no puede— así que un recorrido fijo
 *    apuntaría al vacío. Se filtra contra el DOM antes de arrancar, y si no
 *    queda ningún paso no se abre nada.
 * 2. **Se puede saltar y volver atrás** en cada paso, nunca es lineal
 *    obligatorio.
 * 3. **Solo cuenta como visto si lo cerró la persona.** `destroy()` dispara
 *    `onDestroyed` también cuando lo cierra el cleanup del efecto (o el doble
 *    montaje de Strict Mode en desarrollo); sin la bandera, el recorrido se
 *    marcaba visto sin que nadie lo viera. Misma trampa que ya documentó
 *    `DayStatusTour`.
 */
export function GuidedTour({
  storageKey,
  steps,
  character,
  onReady,
  isReady = true,
}: Props): ReactNode {
  const { t } = useLingui()
  const { isIntroOpen, dismissIntro } = useIntroSeen(storageKey)
  /* El recorrido se arma al vuelo en cada arranque: los controles visibles
     dependen del rol y de lo que haya cargado. */
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  /* El recorrido vivo, para poder cerrarlo si la persona se va de la pantalla
     con él abierto: sin esto el overlay se queda encima de la siguiente. */
  const activo = useRef<ReturnType<typeof driver> | null>(null)

  const run = useCallback(
    (markSeenOnClose: boolean): void => {
      const presentes = stepsRef.current.filter((step) =>
        document.querySelector(`[data-tour="${step.anchor}"]`),
      )
      if (presentes.length === 0) return

      let dismissedByUser = false

      const tour = driver({
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: 'oranje-driver-popover',
        /* Quien pidió menos movimiento no quiere que el foco viaje por la
           pantalla en cada paso. */
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        closeBtnLabel: t`Cerrar`,
        nextBtnText: t`Siguiente`,
        prevBtnText: t`Atrás`,
        doneBtnText: t`Listo`,
        showButtons: ['next', 'previous', 'close'],
        onDestroyed: () => {
          if (markSeenOnClose && dismissedByUser) dismissIntro()
        },
        onDestroyStarted: () => {
          dismissedByUser = true
          tour.destroy()
        },
        onPopoverRender: (popover) => {
          const img = document.createElement('img')
          img.src = character
          img.alt = ''
          img.className = 'oranje-driver-character'
          popover.wrapper.insertBefore(img, popover.title)
        },
        steps: presentes.map((step) => ({
          element: `[data-tour="${step.anchor}"]`,
          popover: { title: step.title, description: step.description },
        })),
      })

      activo.current = tour
      tour.drive()
    },
    [character, dismissIntro, t],
  )

  /* NADA DE ESTO PUEDE DEPENDER DE `run` NI DE `onReady`.
     Las dos cambian de identidad en CADA render —`onReady` porque las
     pantallas lo pasan como función en línea, y `run` porque `useIntroSeen`
     devuelve un `dismissIntro` nuevo cada vez—, así que un efecto que las
     tenga como dependencia y llame a `setState` se dispara a sí mismo sin
     parar. Eso es exactamente lo que pasó: «Maximum update depth exceeded»,
     la ruta cambiaba y la pantalla nunca se dibujaba (Hugo lo vio en vivo,
     2026-10-15). Typecheck, lint y las pruebas en jsdom lo dejaron pasar.

     Se guardan en refs y los efectos quedan sin dependencias inestables. */
  const runRef = useRef(run)
  runRef.current = run
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  /** Estable de por vida: el botón de la pantalla lo guarda una sola vez. */
  const start = useRef((): void => {
    runRef.current(false)
  }).current

  /* Reabrirlo a mano no vuelve a marcar nada: ya estaba visto. */
  useEffect(() => {
    onReadyRef.current?.(start)
  }, [start])

  /* La primera vez arranca solo, pero no antes de que la pantalla tenga sus
     controles dibujados. */
  useEffect(() => {
    if (!isIntroOpen || !isReady || !puedeRecordar()) return
    const id = window.setTimeout(() => {
      runRef.current(true)
    }, 400)
    return () => {
      window.clearTimeout(id)
    }
  }, [isIntroOpen, isReady])

  /* Al salir de la pantalla se cierra. No lo marca visto: cerrarlo por irse
     no es haberlo visto. */
  useEffect(
    () => () => {
      activo.current?.destroy()
      activo.current = null
    },
    [],
  )

  return null
}

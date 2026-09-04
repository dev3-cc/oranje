import { cn } from '@oranje/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  createContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { addDaysIso, diffDaysIso, weekContaining } from '../lib/weekNavigation'

import { formatWeekRange } from '@/shared/lib/formatters'
import { MOTION } from '@/shared/lib/motion'

/** Cuánto hay que arrastrar para que un jalón corto cuente como una semana. */
const DRAG_THRESHOLD_PX = 90
/** Rango del jalón en modo paginado (Horas/Mes, que remontan su contenido). */
const DRAG_RANGE_PX = 170
/** Movimiento mínimo antes de considerar el gesto un arrastre (no un click). */
const DRAG_START_PX = 6

/** Las vistas lo leen para apagar su transición mientras el dedo manda. */
export const WeekDragContext = createContext<{ isDragging: boolean }>({ isDragging: false })

/**
 * El carrusel de semanas. El gesto publica su desplazamiento en la variable
 * CSS `--week-drag-x` y cada vista traduce SOLO su zona de fechas — la columna
 * del colaborador y el riel de horas quedan fijos.
 *
 * En modo `continuous` (la vista Días) la vista dibuja la CINTA completa de
 * semanas: al arrastrar, las fechas vecinas entran en vivo y la cinta SE QUEDA
 * DONDE LA SUELTES — sin imán a los bordes de semana; el título y el resumen
 * se actualizan a la semana que quedó a la vista. Los botones ‹ › y «Hoy» sí
 * alinean la ventana a su semana (son controles discretos). En modo paginado
 * (Horas/Mes) el contenido se remonta al navegar y entra con un fundido. Más
 * allá del principio o el final, la hoja opone resistencia y regresa al borde.
 *
 * El gesto es pointer capture a mano: nada se lo puede comer. En táctil solo
 * se activa cuando la vista no tiene scroll horizontal propio
 * (`allowTouchDrag`).
 */
export function WeekSlider({
  weekStart,
  availableWeeks,
  stepWidth,
  totalDays = 7,
  continuous = false,
  allowTouchDrag = false,
  onNavigate,
  children,
}: {
  weekStart: string
  /** Los lunes con datos, ascendentes. */
  availableWeeks: string[]
  /** Ancho en px de una semana completa: la unidad del carrusel. */
  stepWidth: number
  /** Largo de la cinta en días (modo continuo). */
  totalDays?: number
  /** `true`: la vista dibuja la cinta completa y navegar no la remonta. */
  continuous?: boolean
  /** `true` solo cuando la vista NO scrollea horizontal por sí misma. */
  allowTouchDrag?: boolean
  onNavigate: (week: string) => void
  children: ReactNode
}): ReactNode {
  const reduceMotion = useReducedMotion() ?? false
  const rootRef = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef(0)
  const settleRaf = useRef(0)
  /** Qué dice el arrastre en curso: a qué semana vas a caer, o que ahí se acaba. */
  const [hint, setHint] = useState<{ text: string; isEnd: boolean } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const gesture = useRef<{ pointerId: number; startX: number; active: boolean } | null>(null)
  /** Un arrastre que terminó sobre un botón no debe dispararle el click. */
  const suppressClick = useRef(false)

  const index = Math.max(availableWeeks.indexOf(weekStart), 0)
  const weeksAfter = Math.max(availableWeeks.length - 1 - index, 0)
  const canDrag = continuous ? totalDays > 7 : availableWeeks.length > 1

  /**
   * Geometría de la cinta: `ribbonX` es el translate real de la hoja
   * (= -basePx + var). 0 = la cinta al principio (la semana más vieja);
   * `minRibbonX` = el final (la más reciente pegada a la derecha).
   */
  const columnWidth = stepWidth / 7
  const firstWeek = availableWeeks[0] ?? weekStart
  const basePx = Math.max(diffDaysIso(firstWeek, weekStart), 0) * columnWidth
  const minRibbonX = -Math.max(totalDays - 7, 0) * columnWidth
  /** Navegación nacida del arrastre: no re-alinear la cinta a la semana. */
  const skipSync = useRef(false)
  const dragStartVar = useRef(0)

  function setDragX(value: number): void {
    offsetRef.current = value
    rootRef.current?.style.setProperty('--week-drag-x', `${String(value)}px`)
  }

  /* Cambiar de vista hereda `--week-drag-x` del gesto anterior (la cinta de
     Días publica valores grandes): la hoja nueva nace corrida y con la pista
     colgada. Al cambiar de modo se limpia TODO el estado del gesto. */
  useEffect(() => {
    cancelAnimationFrame(settleRaf.current)
    gesture.current = null
    skipSync.current = false
    setIsDragging(false)
    setHint(null)
    setDragX(0)
  }, [continuous])

  /* ‹ ›, «Hoy» o el mes cambian la semana desde fuera: la ventana SÍ se alinea
     a ella (var → 0). El arrastre marca `skipSync`: ahí la cinta se queda. */
  useEffect(() => {
    if (!continuous) return
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    setDragX(0)
  }, [continuous, weekStart])

  /** El translate pedido, con resistencia más allá del principio o el final. */
  function clampContinuous(desiredVar: number): number {
    const ribbon = -basePx + desiredVar
    if (ribbon > 0) return basePx + Math.min(ribbon / 5, 56)
    if (ribbon < minRibbonX) return minRibbonX + basePx + Math.max((ribbon - minRibbonX) / 5, -56)
    return desiredVar
  }

  /** Modo paginado: rango corto y resistencia sin vecina. */
  function clampOffset(dx: number): number {
    const leftLimit = weeksAfter === 0 ? 0 : DRAG_RANGE_PX
    const rightLimit = index === 0 ? 0 : DRAG_RANGE_PX
    if (dx < -leftLimit) return -leftLimit + Math.max((dx + leftLimit) / 5, -56)
    if (dx > rightLimit) return rightLimit + Math.min((dx - rightLimit) / 5, 56)
    return dx
  }

  /** Cuántas semanas cruzaría el jalón (modo paginado: ±1). */
  function prospectiveShift(offset: number): number {
    let shift = 0
    if (offset < -DRAG_THRESHOLD_PX) shift = 1
    if (offset > DRAG_THRESHOLD_PX) shift = -1
    return Math.max(-index, Math.min(shift, weeksAfter))
  }

  /** La semana del día que quedó al borde izquierdo de la ventana. */
  function weekAtRibbon(ribbon: number): string {
    const clamped = Math.min(Math.max(ribbon, minRibbonX), 0)
    const leftIndex = Math.min(Math.round(-clamped / columnWidth), Math.max(totalDays - 7, 0))
    return weekContaining(availableWeeks, addDaysIso(firstWeek, leftIndex)) ?? weekStart
  }

  /** Regreso animado a 0 para el modo paginado (sin transición CSS propia). */
  function animateBack(): void {
    const from = offsetRef.current
    const startedAt = performance.now()
    const durationMs = MOTION.exit * 1000
    cancelAnimationFrame(settleRaf.current)
    const step = (now: number): void => {
      const progress = Math.min((now - startedAt) / durationMs, 1)
      setDragX(from * (1 - progress) * (1 - progress))
      if (progress < 1) settleRaf.current = requestAnimationFrame(step)
    }
    settleRaf.current = requestAnimationFrame(step)
  }

  function settle(): void {
    setHint(null)

    if (continuous) {
      const ribbon = -basePx + offsetRef.current
      /* La cinta se queda DONDE LA SOLTASTE. Solo se recoge el sobrante de la
         resistencia si jalaste más allá del principio o el final. */
      const target = weekAtRibbon(ribbon)
      let nextBase = basePx
      if (target !== weekStart) {
        skipSync.current = true
        nextBase = Math.max(diffDaysIso(firstWeek, target), 0) * columnWidth
        /* Misma posición visual bajo la nueva base: `ribbon = -base + var` es
           constante, así que la var absorbe el cambio de base CON SU SIGNO. */
        setDragX(offsetRef.current + (nextBase - basePx))
        onNavigate(target)
      }
      setIsDragging(false)
      if (ribbon > 0 || ribbon < minRibbonX) {
        const boundaryVar = (ribbon > 0 ? 0 : minRibbonX) + nextBase
        /* Con la transición de la vista ya activa, regresa suave al borde. */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDragX(boundaryVar)
          })
        })
      }
      return
    }

    const shift = prospectiveShift(offsetRef.current)
    if (shift !== 0) {
      onNavigate(availableWeeks[index + shift] as string)
      setDragX(0)
    } else {
      animateBack()
    }
    setIsDragging(false)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!canDrag) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.pointerType !== 'mouse' && !allowTouchDrag) return
    cancelAnimationFrame(settleRaf.current)
    dragStartVar.current = offsetRef.current
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, active: false }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return

    const dx = event.clientX - current.startX
    if (!current.active) {
      if (Math.abs(dx) < DRAG_START_PX) return
      current.active = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setIsDragging(true)
    }

    event.preventDefault()

    if (continuous) {
      const offset = clampContinuous(dragStartVar.current + dx)
      setDragX(offset)
      /* La etiqueta narra el paseo: qué semana quedó a la vista, o el tope. */
      const ribbon = -basePx + offset
      if (ribbon > 12) {
        setHint({ text: 'No hay semanas anteriores con datos', isEnd: true })
      } else if (ribbon < minRibbonX - 12) {
        setHint({ text: 'Ya estás en la semana más reciente', isEnd: true })
      } else {
        const visibleWeek = weekAtRibbon(ribbon)
        setHint({
          text: `Viendo: ${formatWeekRange(visibleWeek, addDaysIso(visibleWeek, 6))}`,
          isEnd: false,
        })
      }
      return
    }

    const offset = clampOffset(dx)
    setDragX(offset)

    /* La etiqueta narra el gesto: a dónde vas a caer — o que jalas al vacío. */
    const shift = prospectiveShift(offset)
    if (shift !== 0) {
      const target = availableWeeks[index + shift] as string
      setHint({
        text: `Soltar en: ${formatWeekRange(target, addDaysIso(target, 6))}`,
        isEnd: false,
      })
    } else if (offset < -24 && weeksAfter === 0) {
      setHint({ text: 'Ya estás en la semana más reciente', isEnd: true })
    } else if (offset > 24 && index === 0) {
      setHint({ text: 'No hay semanas anteriores con datos', isEnd: true })
    } else {
      setHint(null)
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    gesture.current = null
    if (current.active) {
      suppressClick.current = true
      settle()
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {hint !== null && (
        <div
          className={cn(
            'pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-md px-2.5 py-1 text-xs font-bold shadow-md',
            hint.isEnd ? 'bg-ink/85 text-white' : 'bg-o-500 text-ink',
          )}
        >
          {hint.text}
        </div>
      )}

      {/* La superficie de arrastre es un atajo de puntero; ‹ › y «Hoy» son el
          camino accesible por teclado. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        style={{ touchAction: allowTouchDrag ? 'pan-y' : 'pan-x pan-y' }}
        className={cn(
          'relative',
          canDrag && (isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'),
        )}
      >
        <WeekDragContext.Provider value={{ isDragging }}>
          {continuous ? (
            children
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={weekStart}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : MOTION.enter,
                  ease: [...MOTION.easeOut],
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </WeekDragContext.Provider>
      </div>
    </div>
  )
}

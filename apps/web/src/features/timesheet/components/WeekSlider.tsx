import { cn } from '@oranje/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  createContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { addDaysIso, diffDaysIso, weekContaining } from '../lib/weekNavigation'

import { formatWeekRange } from '@/shared/lib/formatters'
import { MOTION, slideTransition, slideVariants } from '@/shared/lib/motion'

/** Cuánto hay que arrastrar para que un jalón corto cuente como una semana. */
const DRAG_THRESHOLD_PX = 90
/** Rango del jalón en modo paginado (Horas/Mes, que remontan su contenido). */
const DRAG_RANGE_PX = 170
/**
 * Movimiento mínimo antes de considerar el gesto un arrastre (no un click).
 * En modo continuo la cinta se queda donde se suelta (sin imán a la semana),
 * así que un click con unos px de temblor del mouse quedaba mal clasificado
 * como arrastre y dejaba la cinta corrida esos px para siempre — nadie la
 * regresaba a 0 porque, para un arrastre real, ese es justo el comportamiento
 * querido. El umbral sube para que un click normal no lo dispare.
 */
const DRAG_START_PX = 12

/** Las vistas lo leen para apagar su transición mientras el dedo manda. */
export const WeekDragContext = createContext<{ isDragging: boolean }>({ isDragging: false })

/**
 * El carrusel de semanas. El gesto publica su desplazamiento en la variable
 * CSS `--week-drag-x` y cada vista traduce SOLO su zona de fechas — la columna
 * del colaborador y el riel de horas quedan fijos.
 *
 * En modo `continuous` (la vista Días) la vista dibuja la CINTA completa de
 * semanas: al arrastrar, las fechas vecinas entran en vivo y al soltar la
 * cinta ENCAJA AL DÍA MÁS CERCANO — si el gesto reveló más de la mitad de un
 * día vecino, se queda en ese día completo; menos de la mitad, vuelve al de
 * origen. El ancla es el DÍA, nunca la semana entera (eso sería el imán que
 * decidimos no querer); el título y el resumen se actualizan a la semana que
 * quedó a la vista. Los botones ‹ › y «Hoy» sí
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
   * Modo paginado: hacia dónde viajó la última navegación (+1 = semana más
   * reciente, -1 = más vieja) — de un arrastre o de ‹ ›/«Hoy»/el mes, da
   * igual el origen. Se deriva comparando el índice de ESTE render contra el
   * del anterior, ajustado EN RENDER (no en un efecto) para que el
   * `motion.div` de abajo ya vea la dirección correcta en el mismo ciclo en
   * que `weekStart` cambió — un efecto llegaría un render tarde y el primer
   * cuadro de la animación saldría con la dirección vieja.
   */
  const prevIndexRef = useRef(index)
  const [direction, setDirection] = useState(1)
  if (continuous) {
    prevIndexRef.current = index
  } else if (index !== prevIndexRef.current) {
    const nextDirection = index > prevIndexRef.current ? 1 : -1
    if (nextDirection !== direction) setDirection(nextDirection)
    prevIndexRef.current = index
  }

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
  /**
   * El RIBBON (`-basePx + var`, la posición visual — independiente de qué
   * semana es "la base") que `settle()` quiere conservar al cruzar de
   * semana. Se aplica en el layout effect de abajo, NUNCA en `settle()`
   * mismo: `basePx` ahí todavía es el de la semana VIEJA (`weekStart` no ha
   * cambiado, `onNavigate` solo lo pidió) — rebasar el var contra un
   * `basePx` que el string de `transform` del render actual no conoce deja
   * la cinta con la base vieja horneada + un var pensado para la base
   * nueva, un valor internamente inconsistente, hasta que React confirme el
   * cambio de `weekStart`.
   */
  const pendingRibbon = useRef<number | null>(null)
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
    pendingRibbon.current = null
    setIsDragging(false)
    setHint(null)
    setDragX(0)
  }, [continuous])

  /*
   * ‹ ›, «Hoy» o el mes cambian la semana desde fuera: la ventana SÍ se
   * alinea a ella (var → 0). El arrastre marca `skipSync`: ahí la cinta se
   * queda — y si además cruzó de semana, aquí es donde se rebasa el var, NO
   * en `settle()`. `useLayoutEffect` (no `useEffect`) es lo que importa:
   * corre síncrono tras el commit y ANTES de que el navegador pinte, así
   * que la corrección de la base nunca llega tarde a un frame ya pintado —
   * verificado con capturas por `requestAnimationFrame` que, con el
   * `useEffect` original, mostraban la cinta animando ~250ms desde una
   * base vieja hasta la correcta, invadiendo la columna fija del
   * colaborador (bug reportado).
   */
  useLayoutEffect(() => {
    if (!continuous) return
    if (skipSync.current) {
      skipSync.current = false
      if (pendingRibbon.current !== null) {
        /* `basePx` de ESTE render ya es el de la semana nueva (`weekStart`
           acaba de cambiar): recién aquí es seguro rebasar. */
        setDragX(pendingRibbon.current + basePx)
        pendingRibbon.current = null
      }
      return
    }
    setDragX(0)
  }, [continuous, weekStart, basePx])

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
      const rawRibbon = -basePx + offsetRef.current
      const clampedRibbon = Math.min(Math.max(rawRibbon, minRibbonX), 0)
      /*
       * Encaja al DÍA más cercano, no a la semana: si el gesto reveló más de
       * la mitad de un día vecino, la cinta se queda en ese día completo; si
       * reveló menos de la mitad, vuelve al día de origen. `Math.round` ES
       * la regla del 50% — redondear por COLUMNA (un día) y no por semana es
       * justo lo que mantiene el ancla en días. Esto también absorbe el
       * click-con-temblor: un jalón de unos px, muy por debajo de medio
       * `columnWidth`, redondea de vuelta al mismo día de donde salió — ya
       * no hace falta una guardia aparte para eso.
       */
      const snappedRibbon = Math.min(
        Math.max(Math.round(clampedRibbon / columnWidth) * columnWidth, minRibbonX),
        0,
      )
      const target = weekAtRibbon(snappedRibbon)

      setIsDragging(false)

      if (target !== weekStart) {
        skipSync.current = true
        /* Misma posición visual bajo la nueva base: `ribbon = -base + var` es
           constante, así que la var debe absorber el cambio de base CON SU
           SIGNO — pero NO AQUÍ: `basePx` en este `settle()` sigue siendo el
           de la semana VIEJA (`weekStart` todavía no cambió, `onNavigate`
           recién lo está pidiendo). Rebasar el var ya mismo lo dejaría
           coherente con una base que el `transform` del render actual
           todavía no conoce. Se guarda el RIBBON ya encajado y el layout
           effect de arriba lo aplica cuando `basePx` ya es el de `target`. */
        pendingRibbon.current = snappedRibbon
        onNavigate(target)
        return
      }

      /* Sin cambio de semana: nada más va a mover el var, así que el doble
         rAF espera a que el commit de `isDragging=false` reactive la
         transición CSS antes de tocarlo — si no, el encaje se ve como un
         salto instantáneo en vez de animado (mismo patrón que ya usaba el
         regreso al borde). */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDragX(snappedRibbon + basePx)
        })
      })
      return
    }

    const shift = prospectiveShift(offsetRef.current)
    if (shift !== 0) {
      onNavigate(availableWeeks[index + shift] as string)
      setIsDragging(false)
      /*
       * `setDragX` muta `--week-drag-x` en el DOM directamente, fuera de
       * React, y corre SÍNCRONO en este mismo tick — si se dispara aquí, pisa
       * la variable MIENTRAS el nodo todavía trae `transition: none` del
       * render actual (TimesheetHoursView/TimesheetMonthView solo apagan esa
       * transición cuando `isDragging` es `true`, y React no reacciona al
       * `setIsDragging(false)` de arriba hasta su PRÓXIMO commit, no en esta
       * misma línea). El reset a 0 llegaría instantáneo, sin nada que lo
       * anime — el salto reportado, medido en Playwright como un brinco de
       * ~150px en un solo frame. El doble rAF espera a que ese commit
       * (`isDragging=false`, transición ya encendida) haya pintado antes de
       * tocar la variable — mismo patrón que el encaje sin cambio de semana
       * de arriba, y que ya usaba `TimesheetGrid` para la cinta continua.
       */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDragX(0)
        })
      })
      return
    }

    animateBack()
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
      /*
       * `DRAG_START_PX` es deliberadamente bajo para que un arrastre real dé
       * retroalimentación viva de inmediato — pero un click normal con el
       * temblor típico del mouse (10-15px entre mousedown y mouseup) lo cruza
       * igual. Dos problemas distintos nacen de ahí, y los dos se resuelven
       * aquí con el mismo criterio: si el soltar quedó por debajo del umbral
       * que cuenta como arrastre intencional (mismo criterio que `settle()`
       * usa para revertir la cinta: MEDIO `columnWidth`, no uno completo — un
       * jalón de 60% de columna ya mueve la cinta a un día vecino en
       * `settle()`, así que aquí también cuenta como arrastre real; con el
       * umbral completo, ese mismo 60% se colaba como "click" y reproducía un
       * `.click()` de verdad sobre lo que hubiera bajo el dedo — comprobado:
       * abría Revisión del día con un simple jalón de snap), el gesto fue un
       * click, no un arrastre.
       *
       * (1) `setPointerCapture`, ya activo desde que se cruzó `DRAG_START_PX`,
       * hace que el navegador retargetee el `click` de compatibilidad AL
       * ELEMENTO QUE CAPTURÓ — este mismo div —, nunca al botón/enlace que
       * estaba bajo el dedo (comprobado: soltar la captura aquí no alcanza a
       * corregirlo, el navegador ya fijó el target). Así que si el gesto fue
       * un click, se reproduce a mano sobre el elemento real bajo el puntero
       * — `.click()` dispara un evento normal que burbujea por sus
       * ancestros, así que si `elementFromPoint` cae en un ícono o texto
       * DENTRO del botón, el botón lo recibe igual.
       * (2) El click nativo mal dirigido (el del punto 1, con target = este
       * div) todavía va a llegar después: se suprime con `suppressClick`,
       * como ya hacía este código para cualquier arrastre real.
       */
      const finalDx = Math.abs(event.clientX - current.startX)
      const realDragThreshold = continuous ? columnWidth / 2 : DRAG_THRESHOLD_PX
      const wasRealDrag = finalDx >= realDragThreshold
      if (!wasRealDrag) {
        const realTarget = document.elementFromPoint(event.clientX, event.clientY)
        if (realTarget instanceof HTMLElement) realTarget.click()
      }
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
          /* `select-none` va SIEMPRE que se pueda arrastrar, no solo mientras
             `isDragging` ya es true: la selección nativa de texto arranca en
             los primeros px del gesto, antes de que cruce `DRAG_START_PX` y
             se clasifique como arrastre — para entonces ya quedó pegada. */
          canDrag && 'select-none',
          canDrag && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        <WeekDragContext.Provider value={{ isDragging }}>
          {continuous ? (
            children
          ) : (
            /*
             * Deslizamiento direccional real (no solo fundido): la semana que
             * sale se va hacia el lado de la navegación y la que entra viene
             * del lado opuesto, como una cinta. `custom` va tanto en
             * `AnimatePresence` (así la semana que SALE recibe la dirección
             * vigente al momento de salir, no la que tenía cuando montó) como
             * en el propio `motion.div` (para su entrada/estado presente).
             */
            <AnimatePresence mode="popLayout" initial={false} custom={{ direction, reduceMotion }}>
              <motion.div
                key={weekStart}
                custom={{ direction, reduceMotion }}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={slideTransition(reduceMotion)}
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

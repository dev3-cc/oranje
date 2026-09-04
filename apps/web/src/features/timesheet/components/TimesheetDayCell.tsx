import {
  cn,
  statusLight,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TimesheetEntry } from '../types/timesheet.types'

import {
  PUNCH_STATE_LABEL,
  TIMESHEET_STATUS_LABEL,
  TIMESHEET_STATUS_TOKEN,
} from '@/shared/constants/timesheetStatus'
import { formatHours } from '@/shared/lib/formatters'

/** Horas todavía sin calcular: guion largo, que no es lo mismo que cero. */
const NO_HOURS = '—'

/** Cómo se dibuja el punto de checadas según su estado. */
const PUNCH_CLASS = {
  COMPLETE: 'border-transparent',
  INCOMPLETE: 'border-ink-4 bg-transparent',
  NO_SHIFT: 'border-dashed border-ink-4 bg-transparent',
} as const

/** Qué significa el punto, con el detalle que el chip no cuenta. */
const PUNCH_STATE_DETAIL = {
  COMPLETE: 'La persona marcó su entrada y su salida. Revisar el día es aparte: lo dice el chip.',
  INCOMPLETE: 'Hay entrada sin salida (o al revés). Así la semana no puede irse a aprobación.',
  NO_SHIFT: 'Ese día no tenía turno programado.',
} as const

/**
 * Un día de una persona.
 *
 * Lleva DOS indicadores y no uno, porque son dos preguntas distintas: el punto
 * de la izquierda dice si marcó entrada y salida, y el chip de color dice si
 * alguien ya revisó lo que marcó. Un día puede tener las checadas completas y
 * seguir sin revisar.
 *
 * La casilla morada es la selección para actuar en bloque — pagar, revisar—, y
 * por eso comparte el color con el resumen de la selección.
 */
export function TimesheetDayCell({
  entry,
  isSelected,
  selectable = true,
  onToggle,
  onReview,
}: {
  entry: TimesheetEntry
  isSelected: boolean
  /** La casilla de selección existe PARA el pago en bloque: sin permiso de
      pago no se dibuja — una affordance sin acción disponible solo confunde. */
  selectable?: boolean
  onToggle: (entryId: string) => void
  /** Abre la Revisión del día (maqueta del Supervisor). */
  onReview: (entry: TimesheetEntry) => void
}): ReactNode {
  const color = statusLight[TIMESHEET_STATUS_TOKEN[entry.status]]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-2">
        {/* El tooltip explica el punto (patrón del ApproverTooltip de la ficha):
            un símbolo de 14px no puede cargar su propia leyenda. */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label={PUNCH_STATE_LABEL[entry.punch]}
                role="img"
                tabIndex={0}
                className={cn(
                  'flex size-3.5 cursor-help items-center justify-center overflow-hidden rounded-full border-2',
                  PUNCH_CLASS[entry.punch],
                )}
                style={
                  entry.punch === 'COMPLETE'
                    ? { backgroundColor: statusLight['st-verde'] }
                    : undefined
                }
              >
                {/* La paloma: el color nunca habla solo (entrada y salida completas).
                    SVG propio — la ligadura de Material se deforma a este tamaño. */}
                {entry.punch === 'COMPLETE' && (
                  <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
                    <path
                      d="M2.5 6.5l2.4 2.4 4.6-5"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-52">
              <p className="text-xs font-semibold">{PUNCH_STATE_LABEL[entry.punch]}</p>
              <p className="mt-0.5 text-xs">{PUNCH_STATE_DETAIL[entry.punch]}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {
              onToggle(entry.id)
            }}
            aria-label={`Seleccionar ${entry.date}`}
            className="size-3.5 appearance-none rounded-full border-2 border-purple checked:bg-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onReview(entry)
        }}
        title="Revisar el día"
        className={cn(
          /* `bg-surface` DEBAJO del tinte: el color del estado va con alfa y,
             sin fondo sólido, el carril de atrás se transparenta y lo ensucia. */
          'w-full cursor-pointer rounded-lg bg-surface p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
          isSelected && 'ring-2 ring-purple',
        )}
        style={{ backgroundImage: `linear-gradient(${color}26, ${color}26)` }}
      >
        <p className="flex items-center justify-between gap-2">
          {/* `text-xs`: «Pendiente» completo cabe hasta en la columna angosta. */}
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="truncate">{TIMESHEET_STATUS_LABEL[entry.status]}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-ink-2">
            {entry.hours === null ? NO_HOURS : formatHours(entry.hours)}
          </span>
        </p>

        <p className="mt-1.5 truncate text-xs text-ink-3">
          {entry.startTime === null || entry.endTime === null
            ? NO_HOURS
            : `${entry.startTime} – ${entry.endTime}`}
        </p>
        {/* La requisición NO se repite aquí: la fila entera es una requisición
            y ya lo dice —una sola vez— el badge de la ficha del colaborador. */}
      </button>
    </div>
  )
}

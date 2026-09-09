import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
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
  type PunchState,
} from '@/shared/constants/timesheetStatus'
import { formatHours } from '@/shared/lib/formatters'

/** Horas todavía sin calcular: guion largo, que no es lo mismo que cero. */
const NO_HOURS = '—'

/**
 * Cómo se dibuja el punto de checadas. Antes INCOMPLETE y NO_SHIFT eran el
 * mismo círculo hueco (uno con borde punteado): a simple vista se veían
 * idénticos. Ahora cada uno tiene su propia forma Y color — sin repetir los
 * que ya usa el chip de arriba en esta misma tarjeta (azul claro, amarillo,
 * morado del estado del día; verde de "Completo") para no romper "un color =
 * un significado" dentro de la misma tarjeta.
 */
const PUNCH_CLASS = {
  COMPLETE: 'border-transparent',
  INCOMPLETE: 'border-transparent',
  NO_SHIFT: 'border-dashed border-ink-4 bg-transparent',
} as const

/** Qué significa el punto, con el detalle que el chip no cuenta. */
const PUNCH_STATE_DETAIL: Record<PunchState, MessageDescriptor> = {
  COMPLETE: msg`La persona marcó su entrada y su salida. Revisar el día es aparte: lo dice el chip.`,
  INCOMPLETE: msg`Hay entrada sin salida (o al revés). Así la semana no puede irse a aprobación.`,
  NO_SHIFT: msg`No se registró entrada ni salida. Puede ser que no tuviera turno ese día, o que el ponche no llegara a guardarse (por ejemplo, fuera de la geocerca). Revisa el Schedule para saber cuál de las dos fue.`,
}

/**
 * La versión corta del punto: cabe junto al horario sin depender del hover
 * (un icono sin palabra al lado, solo con tooltip, no se entiende — mismo
 * hallazgo que ya corrigió el chip de revisión: el color nunca habla solo).
 */
const PUNCH_STATE_SHORT_LABEL: Record<PunchState, MessageDescriptor> = {
  COMPLETE: msg`Completo`,
  INCOMPLETE: msg`Incompleto`,
  NO_SHIFT: msg`Sin marcas`,
}

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
  onPunchHover,
}: {
  entry: TimesheetEntry
  isSelected: boolean
  /** La casilla de selección existe PARA el pago en bloque: sin permiso de
      pago no se dibuja — una affordance sin acción disponible solo confunde. */
  selectable?: boolean
  onToggle: (entryId: string) => void
  /** Abre la Revisión del día (maqueta del Supervisor). */
  onReview: (entry: TimesheetEntry) => void
  /** El puntito de checadas tiene su PROPIO tooltip (preciso, ya andando
      solo). Cuando el mouse está exactamente encima, el marco de la
      requisición —más general— debe ceder el suyo: el elemento más
      específico manda. El marco puede seguir "encendido" (borde animado),
      solo su tooltip de texto se apaga. */
  onPunchHover?: (hovering: boolean) => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const color = statusLight[TIMESHEET_STATUS_TOKEN[entry.status]]

  return (
    <div className="flex flex-col gap-2">
      {selectable && (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {
              onToggle(entry.id)
            }}
            aria-label={t`Seleccionar ${entry.date}`}
            className="size-3.5 appearance-none rounded-full border-2 border-purple checked:bg-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          onReview(entry)
        }}
        title={entry.status === 'REVIEWED' ? t`Ver revisión del día` : t`Revisar el día`}
        className={cn(
          /* `bg-surface` DEBAJO del tinte: el color del estado va con alfa y,
             sin fondo sólido, el carril de atrás se transparenta y lo ensucia. */
          /* `rounded-xl`, igual que el marco punteado de la requisición
             (`TimesheetGrid`, `borderRadius: 0.75rem`) — con radios distintos
             la esquina no coincidía. */
          'w-full cursor-pointer rounded-xl bg-surface p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
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
            {/* `isAbsence` no se pinta: hoy nada en el sistema lo calcula (solo
                se ha visto en un fixture de prueba a mano) — mostrarlo confunde
                más de lo que informa. Queda como pendiente real: el sistema no
                distingue hoy un día sin turno de un no-show. */}
            {entry.hours === null ? NO_HOURS : formatHours(entry.hours)}
          </span>
        </p>

        {/* El punto de checadas vive AQUÍ, junto al horario que describe, con su
            palabra al lado — no solo, no solo con tooltip. El tooltip se
            conserva como refuerzo (por qué), no como único canal (qué). */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                tabIndex={0}
                onMouseEnter={() => {
                  onPunchHover?.(true)
                }}
                onMouseLeave={() => {
                  onPunchHover?.(false)
                }}
                className="mt-1.5 flex cursor-help items-center gap-1 truncate text-xs text-ink-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-2.5 shrink-0 items-center justify-center overflow-hidden rounded-full border-2',
                    PUNCH_CLASS[entry.punch],
                  )}
                  style={
                    entry.punch === 'COMPLETE'
                      ? { backgroundColor: statusLight['st-verde'] }
                      : entry.punch === 'INCOMPLETE'
                        ? { backgroundColor: statusLight['st-rojo'] }
                        : undefined
                  }
                >
                  {entry.punch === 'COMPLETE' && (
                    <svg viewBox="0 0 12 12" className="size-2" aria-hidden>
                      <path
                        d="M2.5 6.5l2.4 2.4 4.6-5"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {entry.punch === 'INCOMPLETE' && (
                    <span className="text-[7px] leading-none font-black text-white">!</span>
                  )}
                  {entry.punch === 'NO_SHIFT' && (
                    <span className="text-[7px] leading-none font-black text-ink-4">?</span>
                  )}
                </span>
                <span className="font-semibold text-ink-2">
                  {i18n._(PUNCH_STATE_SHORT_LABEL[entry.punch])}
                </span>
                {entry.startTime !== null && entry.endTime !== null && (
                  <span>
                    · {entry.startTime} – {entry.endTime}
                  </span>
                )}
              </p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-52">
              <p className="text-xs font-semibold">{PUNCH_STATE_LABEL[entry.punch]}</p>
              <p className="mt-0.5 text-xs">{i18n._(PUNCH_STATE_DETAIL[entry.punch])}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* La requisición NO se repite aquí: la fila entera es una requisición
            y ya lo dice —una sola vez— el badge de la ficha del colaborador. */}
      </button>
    </div>
  )
}

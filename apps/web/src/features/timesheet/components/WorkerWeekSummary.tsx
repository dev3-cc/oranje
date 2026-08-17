import type { ReactNode } from 'react'

import type { TimesheetRow } from '../types/timesheet.types'

import { formatHours } from '@/shared/lib/formatters'

/** Un dato de la fila: contorno tenue, sin color de estado. */
function Chip({ children, isPending }: { children: ReactNode; isPending?: boolean }): ReactNode {
  return (
    <span
      className={
        isPending === true
          ? 'inline-flex items-center rounded-md border border-dashed border-purple px-2.5 py-1 text-xs font-medium text-purple'
          : 'inline-flex items-center rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-3'
      }
    >
      {children}
    </span>
  )
}

/**
 * La columna fija de la izquierda: quién es, cuánto lleva y qué le falta.
 *
 * El total lo manda el backend sumado y NO se deriva de las celdas visibles: la
 * semana puede traer días fuera de la ventana, y una barra que cambia al hacer
 * scroll no sirve para nada.
 */
export function WorkerWeekSummary({ row }: { row: TimesheetRow }): ReactNode {
  const progress = row.targetHours > 0 ? Math.min(1, row.totalHours / row.targetHours) : 0

  return (
    <div className="flex gap-3">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-o-500 text-sm font-bold text-white"
        aria-hidden
      >
        {row.workerName.charAt(0)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink">{row.workerName}</p>
        <p className="truncate text-xs text-ink-3">{row.jobTitle}</p>

        <p className="mt-1 text-2xl font-bold text-ink">
          {formatHours(row.totalHours)}
          <span className="ml-1 text-sm font-normal text-ink-3">
            / {formatHours(row.targetHours)}
          </span>
        </p>

        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
          role="img"
          aria-label={`${formatHours(row.totalHours)} de ${formatHours(row.targetHours)}`}
        >
          {progress > 0 && (
            <div
              className="h-full rounded-full bg-green"
              style={{ width: `${(progress * 100).toFixed(1)}%` }}
            />
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {row.withoutRequisitionCount > 0 && <Chip>Sin req.</Chip>}
          {row.unpaidCount > 0 ? (
            <Chip isPending>Pagar {row.unpaidCount}</Chip>
          ) : (
            <Chip>0 sin pagar</Chip>
          )}
        </div>
      </div>
    </div>
  )
}

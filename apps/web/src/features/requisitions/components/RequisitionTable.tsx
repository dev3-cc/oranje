import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import type { RequisitionRow } from '../types/requisition.types'

import { CoverageBar } from './CoverageBar'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
  URGENCY_LABEL,
  URGENCY_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { formatDayMonthTime } from '@/shared/lib/formatters'

const HEADERS = [
  'Número',
  'Hotel',
  'Departamento',
  'Pos.',
  'Cobertura',
  'Urgencia',
  'Estado',
  'Autorizada',
  'Inspector',
]

/** Sin autorizar todavía: guion largo, no celda vacía. */
const NOT_AUTHORIZED = '—'

/**
 * Tabla del tablero de Requisiciones.
 *
 * Scroll horizontal propio: son nueve columnas y en pantallas estrechas la
 * alternativa sería recortarlas o apilar la tabla, y ninguna de las dos deja
 * comparar filas, que es para lo que existe.
 */
export function RequisitionTable({ items }: { items: RequisitionRow[] }): ReactNode {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        No hay requisiciones que mostrar.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[68rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {HEADERS.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3.5 text-xs font-semibold tracking-wide text-ink-3 uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => {
                void navigate(`/requisiciones/${item.id}`)
              }}
              className="cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2"
            >
              <td className="px-4 py-4 text-sm font-medium whitespace-nowrap">
                {/* Enlace y no `onClick` en la fila: así conserva abrir en pestaña nueva. */}
                <Link
                  to={`/requisiciones/${item.id}`}
                  className="rounded-sm text-ink hover:text-o-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  {item.number}
                </Link>
              </td>
              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">{item.hotelName}</td>
              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">{item.department}</td>
              <td className="px-4 py-4 text-sm text-ink-2">{item.positions}</td>

              <td className="px-4 py-4">
                <CoverageBar coverage={item.coverage} />
              </td>

              <td className="px-4 py-4 whitespace-nowrap">
                <span className="flex items-center gap-2 text-sm text-ink-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: statusLight[URGENCY_TOKEN[item.urgency]] }}
                    aria-hidden
                  />
                  {URGENCY_LABEL[item.urgency]}
                </span>
              </td>

              <td className="px-4 py-4">
                <StatusLightSoftBadge
                  token={REQUISITION_STATUS_TOKEN[item.status]}
                  label={REQUISITION_STATUS_LABEL[item.status]}
                />
              </td>

              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {item.authorizedAt ? formatDayMonthTime(item.authorizedAt) : NOT_AUTHORIZED}
              </td>

              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {item.inspectorName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

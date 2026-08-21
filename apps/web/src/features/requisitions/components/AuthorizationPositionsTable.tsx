import type { ReactNode } from 'react'

import type { RequisitionPosition } from '../types/requisition.types'

import { formatDate } from '@/shared/lib/formatters'

const HEADERS = ['#', 'Posición', 'Modalidad', 'Cant.', 'Inicio', 'Hora', 'Inglés']

/**
 * Lo que se está firmando, línea por línea.
 *
 * No lleva cobertura ni urgencia, que sí están en el detalle: antes de la firma
 * no hay nada cubierto —los slots ni siquiera salen a la Bolsa— y la urgencia
 * todavía no existe, porque nace justo al autorizar. Lo que importa aquí es lo
 * que se pidió: modalidad, cuántos, cuándo entran y qué inglés exige el puesto.
 */
export function AuthorizationPositionsTable({
  positions,
}: {
  positions: RequisitionPosition[]
}): ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {HEADERS.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {positions.map((position) => (
            <tr key={position.id} className="border-b border-line last:border-b-0">
              <td className="px-4 py-4 text-sm text-ink-3">{position.index}</td>
              <td className="px-4 py-4 text-sm font-medium whitespace-nowrap text-ink">
                {position.name}
              </td>
              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {position.modality}
              </td>
              <td className="px-4 py-4 text-sm text-ink-2">{position.quantity}</td>
              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {formatDate(position.startDate)}
              </td>
              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {position.startTime}
              </td>
              <td className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">{position.english}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

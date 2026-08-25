import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionPosition } from '../types/requisition.types'

import { formatDate } from '@/shared/lib/formatters'

const HEADERS = ['#', 'Posición', 'Modalidad', 'Cant.', 'Inicio', 'Hora', 'Inglés']

export function AuthorizationPositionsTable({
  positions,
}: {
  positions: RequisitionPosition[]
}): ReactNode {
  return (
    <Table className="min-w-[44rem] text-left">
      <TableHeader>
        <TableRow className="border-line">
          {HEADERS.map((header) => (
            <TableHead
              key={header}
              scope="col"
              className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
            >
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {positions.map((position) => (
          <TableRow key={position.id} className="border-line">
            <TableCell className="px-4 py-4 text-sm text-ink-3">{position.index}</TableCell>
            <TableCell className="px-4 py-4 text-sm font-medium whitespace-nowrap text-ink">
              {position.name}
            </TableCell>
            <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
              {position.modality}
            </TableCell>
            <TableCell className="px-4 py-4 text-sm text-ink-2">{position.quantity}</TableCell>
            <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
              {formatDate(position.startDate)}
            </TableCell>
            <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
              {position.startTime}
            </TableCell>
            <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
              {position.english}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

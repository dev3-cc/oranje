import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionPosition } from '../types/requisition.types'

import { formatDate } from '@/shared/lib/formatters'

/** `#` no es texto: se pinta tal cual; el resto se traduce al pintar con `i18n._()` (D-36). */
const HEADERS: readonly (MessageDescriptor | '#')[] = [
  '#',
  msg`Posición`,
  msg`Modalidad`,
  msg`Cant.`,
  msg`Inicio`,
  msg`Hora`,
  msg`Inglés`,
]

export function AuthorizationPositionsTable({
  positions,
}: {
  positions: RequisitionPosition[]
}): ReactNode {
  const { i18n } = useLingui()

  return (
    <Table className="min-w-[44rem] text-left">
      <TableHeader>
        <TableRow className="border-line">
          {HEADERS.map((header) => {
            const label = header === '#' ? header : i18n._(header)
            return (
              <TableHead
                key={label}
                scope="col"
                className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
              >
                {label}
              </TableHead>
            )
          })}
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

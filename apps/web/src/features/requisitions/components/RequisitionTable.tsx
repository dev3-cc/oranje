import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  statusLight,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import type { RequisitionRow } from '../types/requisition.types'

import { CoverageBar } from './CoverageBar'

import { EmptyState } from '@/shared/components/EmptyState'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
  URGENCY_LABEL,
  URGENCY_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/** Los encabezados se traducen al pintar con `i18n._()` (D-36). */
const HEADERS: readonly MessageDescriptor[] = [
  msg`Número`,
  msg`Hotel`,
  msg`Departamento`,
  msg`Pos.`,
  msg`Cobertura`,
  msg`Urgencia`,
  msg`Estado`,
  msg`Autorizada`,
  msg`Inspector`,
]

const NOT_AUTHORIZED = '—'

export function RequisitionTable({ items }: { items: RequisitionRow[] }): ReactNode {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <EmptyState
        title={t`Aún no hay requisiciones`}
        text={t`Cuando un hotel pida personal, su requisición aparecerá aquí con su semáforo. Los borradores solo los ve quien los crea.`}
      />
    )
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <Table className="min-w-[68rem] text-left">
        <TableHeader>
          <TableRow className="border-line">
            {HEADERS.map((header) => (
              <TableHead
                key={header.id}
                scope="col"
                className="px-4 py-3.5 text-xs font-semibold tracking-wide text-ink-3 uppercase"
              >
                {i18n._(header)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              onClick={() => {
                void navigate(`/requisiciones/${item.id}`)
              }}
              className="cursor-pointer border-line hover:bg-surface-2"
            >
              <TableCell className="px-4 py-4 text-sm font-medium whitespace-nowrap">
                {}
                <Link
                  to={`/requisiciones/${item.id}`}
                  className="rounded-sm text-ink hover:text-o-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  {item.number}
                </Link>
              </TableCell>
              <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {item.hotelName}
              </TableCell>
              <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {item.department}
              </TableCell>
              <TableCell className="px-4 py-4 text-sm text-ink-2">{item.positions}</TableCell>

              <TableCell className="px-4 py-4">
                <CoverageBar coverage={item.coverage} />
              </TableCell>

              <TableCell className="px-4 py-4 whitespace-nowrap">
                <span className="flex items-center gap-2 text-sm text-ink-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: statusLight[URGENCY_TOKEN[item.urgency]] }}
                    aria-hidden
                  />
                  {URGENCY_LABEL[item.urgency]}
                </span>
              </TableCell>

              <TableCell className="px-4 py-4">
                <StatusLightSoftBadge
                  token={REQUISITION_STATUS_TOKEN[item.status]}
                  label={REQUISITION_STATUS_LABEL[item.status]}
                />
              </TableCell>

              <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {item.authorizedAt ? formatDayMonthTime(item.authorizedAt) : NOT_AUTHORIZED}
              </TableCell>

              <TableCell className="px-4 py-4 text-sm whitespace-nowrap text-ink-2">
                {item.inspectorName}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

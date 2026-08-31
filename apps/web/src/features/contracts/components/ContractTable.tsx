import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ContractRow } from '../types/contract.types'

import { ValidityCell } from './ValidityCell'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'

const HEADERS = ['Número', 'Hotel', 'Estado', 'Vigencia', 'Posiciones', 'Overtime · Festivo', '']

const NO_MULTIPLIER = '—'

function formatMultiplier(value: number | null): string {
  return value === null ? NO_MULTIPLIER : `${value.toFixed(2)} ×`
}

export function ContractTable({
  items,
  warningDays,
}: {
  items: ContractRow[]
  warningDays: number
}): ReactNode {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Ningún contrato coincide con esos filtros. Cambia el estado, la zona o la búsqueda.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <Table className="min-w-[62rem] text-left">
        <TableHeader>
          <TableRow className="border-line">
            {HEADERS.map((header) => (
              <TableHead
                key={header === '' ? 'acciones' : header}
                scope="col"
                className="px-5 py-4 text-sm font-normal text-ink-3"
              >
                {header === '' ? <span className="sr-only">Acciones</span> : header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id} className="border-line hover:bg-surface-2">
              <TableCell className="px-5 py-5 text-base font-bold">
                {}
                <Link
                  to={`/documentos-tc/${row.id}`}
                  className="rounded-sm text-ink hover:text-o-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  {row.number}
                </Link>
              </TableCell>
              <TableCell className="px-5 py-5 text-base text-ink-2">{row.hotelName}</TableCell>

              <TableCell className="px-5 py-5">
                <StatusLightSoftBadge
                  token={CONTRACT_STATUS_TOKEN[row.status]}
                  label={CONTRACT_STATUS_LABEL[row.status]}
                />
              </TableCell>

              <TableCell className="px-5 py-5">
                <ValidityCell row={row} warningDays={warningDays} />
              </TableCell>

              <TableCell className="px-5 py-5 text-base text-ink-2">{row.positionCount}</TableCell>

              <TableCell className="px-5 py-5 text-base text-ink-3">
                {formatMultiplier(row.overtimeBillMultiplier)} ·{' '}
                {formatMultiplier(row.holidayBillMultiplier)}
              </TableCell>

              <TableCell className="px-5 py-5 text-right">
                <Link
                  to={`/documentos-tc/${row.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-o-50 px-4 py-2 text-sm font-medium text-o-700 hover:bg-o-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  Abrir <span aria-hidden>→</span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

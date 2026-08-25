import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ContractRate } from '../types/contract.types'
import { marginOf } from '../utils/validity'

import { SectionCard } from '@/shared/components/SectionCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatMoney } from '@/shared/lib/formatters'

const HEADERS = IS_DEV_UI
  ? ['catalog_position', 'pay_rate', 'bill_rate', 'margen']
  : ['Posición', 'Se le paga al colaborador', 'Se le factura al hotel', 'Margen']

export function RateTable({ rates }: { rates: ContractRate[] }): ReactNode {
  return (
    <SectionCard
      title="Tarifas por posición"
      subtitle={
        IS_DEV_UI
          ? 'commercial.contract_rate · una fila por posición del catálogo'
          : 'Una tarifa por posición del catálogo'
      }
    >
      {rates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3">
          Todavía no se cotiza ninguna posición.
        </p>
      ) : (
        <Table className="min-w-[34rem] text-left">
          <TableHeader>
            <TableRow className="border-line">
              {HEADERS.map((header) => (
                <TableHead
                  key={header}
                  scope="col"
                  className="px-4 py-3 text-sm font-normal text-ink-3"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rates.map((rate) => (
              <TableRow key={rate.id} className="border-line">
                <TableHead
                  scope="row"
                  className="px-4 py-5 text-left text-base font-semibold whitespace-nowrap text-ink"
                >
                  {rate.positionName}
                </TableHead>
                <TableCell className="px-4 py-5 text-base text-ink-2">
                  {formatMoney(rate.payRate)}
                </TableCell>
                <TableCell className="px-4 py-5 text-base font-bold text-o-700">
                  {formatMoney(rate.billRate)}
                </TableCell>
                <TableCell className="px-4 py-5 text-base text-ink-3">
                  {formatMoney(marginOf(rate.payRate, rate.billRate))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

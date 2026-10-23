import { useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ContractRate } from '../types/contract.types'
import { marginOf } from '../utils/validity'

import { SectionCard } from '@/shared/components/SectionCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatMoney } from '@/shared/lib/formatters'

export function RateTable({
  rates,
  onEdit,
}: {
  rates: ContractRate[]
  /** Abre «Editar tarifas». Sin él, la tarjeta es de solo lectura (candado, permiso). */
  onEdit?: (() => void) | undefined
}): ReactNode {
  const { t } = useLingui()

  const headers = IS_DEV_UI
    ? ['catalog_position', 'pay_rate', 'bill_rate', 'margen']
    : [t`Posición`, t`Se le paga al colaborador`, t`Se le factura al hotel`, t`Margen`]

  return (
    <SectionCard
      title={t`Tarifas por posición`}
      subtitle={
        IS_DEV_UI
          ? 'commercial.contract_rate · una fila por posición del catálogo'
          : t`Una tarifa por posición del catálogo`
      }
      action={
        onEdit && rates.length > 0 ? (
          /* El lápiz donde están las tarifas (Hugo, 2026-10-23): «Qué sigue»
             pedía corregir una y aquí no había cómo. Mismo lápiz que las
             demás tarjetas. */
          <button
            type="button"
            aria-label={t`Corregir una tarifa`}
            onClick={onEdit}
            className="shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-o-50 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          >
            <MaterialIcon name="edit" aria-hidden className="text-lg" />
          </button>
        ) : undefined
      }
    >
      {rates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3">
          {t`Este contrato no trae ninguna posición cotizada.`}
        </p>
      ) : (
        <Table className="min-w-[34rem] text-left">
          <TableHeader>
            <TableRow className="border-line">
              {headers.map((header) => (
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

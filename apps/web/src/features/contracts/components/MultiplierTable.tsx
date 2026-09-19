import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ContractMultiplier } from '../types/contract.types'
import { marginOf } from '../utils/validity'

import { SectionCard } from '@/shared/components/SectionCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)} ×`
}

function formatMargin(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function MultiplierRow({
  label,
  multiplier,
}: {
  label: string
  multiplier: ContractMultiplier
}): ReactNode {
  const margin = marginOf(multiplier.pay, multiplier.bill)

  return (
    <TableRow className="border-line">
      <TableHead scope="row" className="py-5 pr-4 text-left text-base font-semibold text-ink">
        {label}
      </TableHead>
      <TableCell className="px-4 py-5 text-base font-bold text-ink">
        {formatMultiplier(multiplier.pay)}
      </TableCell>
      {}
      <TableCell className="px-4 py-5 text-base font-bold text-o-700">
        {formatMultiplier(multiplier.bill)}
      </TableCell>
      <TableCell className="px-4 py-5">
        <span className="inline-flex rounded-full bg-green/15 px-3 py-1.5 text-sm font-medium text-ink-2">
          {formatMargin(margin)}
        </span>
      </TableCell>
    </TableRow>
  )
}

export function MultiplierTable({
  overtime,
  holiday,
}: {
  overtime: ContractMultiplier
  holiday: ContractMultiplier
}): ReactNode {
  const { t } = useLingui()

  return (
    <SectionCard
      title={t`Multiplicadores`}
      subtitle={
        IS_DEV_UI
          ? 'los cuatro son NOT NULL y ninguno puede bajar de 1.00'
          : t`Overtime y día festivo según el contrato (mínimo 1.00×)`
      }
    >
      <Table className="min-w-[34rem] text-left">
        <TableHeader>
          <TableRow className="border-line">
            <TableHead scope="col" className="py-3 pr-4 text-sm font-normal text-ink-3">
              <span className="sr-only">
                <Trans>Concepto</Trans>
              </span>
            </TableHead>
            <TableHead scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
              <Trans>Se le paga al colaborador</Trans>
            </TableHead>
            <TableHead scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
              <Trans>Se le factura al hotel</Trans>
            </TableHead>
            <TableHead scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
              <Trans>Margen</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <MultiplierRow label={t`Overtime`} multiplier={overtime} />
          <MultiplierRow label={t`Día festivo`} multiplier={holiday} />
        </TableBody>
      </Table>
    </SectionCard>
  )
}

import type { ReactNode } from 'react'

import { marginOf } from '../lib/validity'
import type { ContractRate } from '../types/contract.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { formatMoney } from '@/shared/lib/formatters'

const HEADERS = ['catalog_position', 'pay_rate', 'bill_rate', 'margen']

/** Las tarifas del contrato, una por posición del catálogo. */
export function RateTable({ rates }: { rates: ContractRate[] }): ReactNode {
  return (
    <SectionCard
      title="Tarifas por posición"
      subtitle="commercial.contract_rate · una fila por posición del catálogo"
    >
      {rates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3">
          Todavía no se cotiza ninguna posición.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id} className="border-b border-line last:border-b-0">
                  <th
                    scope="row"
                    className="px-4 py-5 text-left text-base font-semibold whitespace-nowrap text-ink"
                  >
                    {rate.positionName}
                  </th>
                  <td className="px-4 py-5 text-base text-ink-2">{formatMoney(rate.payRate)}</td>
                  <td className="px-4 py-5 text-base font-bold text-o-700">
                    {formatMoney(rate.billRate)}
                  </td>
                  <td className="px-4 py-5 text-base text-ink-3">
                    {formatMoney(marginOf(rate.payRate, rate.billRate))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

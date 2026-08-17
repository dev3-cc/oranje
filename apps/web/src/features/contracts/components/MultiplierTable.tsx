import type { ReactNode } from 'react'

import type { ContractMultiplier } from '../types/contract.types'
import { marginOf } from '../utils/validity'

import { SectionCard } from '@/shared/components/SectionCard'

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)} ×`
}

/** `+0.50`. Siempre con signo: el margen negativo lo prohíbe el motor, y verlo delataría un bug. */
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
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="py-5 pr-4 text-left text-base font-semibold text-ink">
        {label}
      </th>
      <td className="px-4 py-5 text-base font-bold text-ink">{formatMultiplier(multiplier.pay)}</td>
      {/* Lo que se factura va en naranja: es la cifra que sostiene el margen. */}
      <td className="px-4 py-5 text-base font-bold text-o-700">
        {formatMultiplier(multiplier.bill)}
      </td>
      <td className="px-4 py-5">
        <span className="inline-flex rounded-full bg-green/15 px-3 py-1.5 text-sm font-medium text-ink-2">
          {formatMargin(margin)}
        </span>
      </td>
    </tr>
  )
}

/**
 * Lo que se paga y lo que se factura por hora extra y por día festivo.
 *
 * El margen NO viene del backend: es una resta entre dos números de esta misma
 * respuesta, sin reloj ni paginación de por medio, así que calcularlo aquí no
 * puede desviarse. Es otra cosa que los agregados de un tablero.
 */
export function MultiplierTable({
  overtime,
  holiday,
}: {
  overtime: ContractMultiplier
  holiday: ContractMultiplier
}): ReactNode {
  return (
    <SectionCard
      title="Multiplicadores"
      subtitle="los cuatro son NOT NULL y ninguno puede bajar de 1.00"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-4 text-sm font-normal text-ink-3">
                <span className="sr-only">Concepto</span>
              </th>
              <th scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
                Se le paga al colaborador
              </th>
              <th scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
                Se le factura al hotel
              </th>
              <th scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
                Margen
              </th>
            </tr>
          </thead>
          <tbody>
            <MultiplierRow label="Overtime" multiplier={overtime} />
            <MultiplierRow label="Día festivo" multiplier={holiday} />
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

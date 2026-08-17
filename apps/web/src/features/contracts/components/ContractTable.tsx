import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ContractRow } from '../types/contract.types'

import { ValidityCell } from './ValidityCell'

import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'

const HEADERS = ['number', 'hotel', 'estado', 'vigencia', 'posiciones', 'overtime · festivo', '']

/** Multiplicador sin valor: el borrador todavía no los tiene. */
const NO_MULTIPLIER = '—'

function formatMultiplier(value: number | null): string {
  return value === null ? NO_MULTIPLIER : `${value.toFixed(2)} ×`
}

/**
 * La tabla de contratos.
 *
 * UN SOLO CHIP POR RENGLÓN, a propósito: el estado. La vigencia va con barra y
 * los multiplicadores en texto plano. Si las tres cosas compitieran en color, el
 * verde significaría «activo», «recién empezado» y «sin overtime» a la vez.
 */
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
        Ningún contrato coincide con el filtro.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[62rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {HEADERS.map((header) => (
              <th
                key={header === '' ? 'acciones' : header}
                scope="col"
                className="px-5 py-4 text-sm font-normal text-ink-3"
              >
                {header === '' ? <span className="sr-only">Acciones</span> : header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-surface-2">
              <td className="px-5 py-5 text-base font-bold whitespace-nowrap">
                {/* El documento mismo abre la ficha, no solo el botón del final
                    del renglón: el folio es lo que la gente intenta pulsar. */}
                <Link
                  to={`/documentos-tc/${row.id}`}
                  className="rounded-sm text-ink hover:text-o-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  {row.number}
                </Link>
              </td>
              <td className="px-5 py-5 text-base whitespace-nowrap text-ink-2">{row.hotelName}</td>

              <td className="px-5 py-5">
                <SemaforoSoftBadge
                  token={CONTRACT_STATUS_TOKEN[row.status]}
                  label={CONTRACT_STATUS_LABEL[row.status]}
                />
              </td>

              <td className="px-5 py-5">
                <ValidityCell row={row} warningDays={warningDays} />
              </td>

              <td className="px-5 py-5 text-base text-ink-2">{row.positionCount}</td>

              <td className="px-5 py-5 text-base whitespace-nowrap text-ink-3">
                {formatMultiplier(row.overtimeBillMultiplier)} ·{' '}
                {formatMultiplier(row.holidayBillMultiplier)}
              </td>

              <td className="px-5 py-5 text-right">
                <Link
                  to={`/documentos-tc/${row.id}`}
                  /* Al pasar el ratón se oscurece el fondo, no el texto: blanco
                     sobre naranja da 2.5:1 y reprueba AA. */
                  className="inline-flex items-center gap-1.5 rounded-md bg-o-50 px-4 py-2 text-sm font-medium text-o-700 hover:bg-o-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  Abrir <span aria-hidden>→</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

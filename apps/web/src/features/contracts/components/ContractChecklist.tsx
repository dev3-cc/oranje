import { MaterialIcon, cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ContractDetail } from '../types/contract.types'

/**
 * La lista de verificación del contrato: lo que el motor exige para
 * activarlo (los mismos guards de la migración, en palabras) más lo que
 * conviene revisar antes. Se calcula en el front con los datos que ya
 * trajo la ficha (D-28): si aquí sale un problema, activar va a fallar con
 * ese mismo motivo — mejor verlo antes de tocar el botón.
 */
export type CheckStatus = 'ok' | 'pending' | 'fail'

export interface ContractCheck {
  id: string
  status: CheckStatus
  title: string
  detail: string
}

export function buildContractChecks(contract: ContractDetail): ContractCheck[] {
  const today = new Date().toISOString().slice(0, 10)
  const rates = contract.rates
  const badMargin = rates.filter((rate) => rate.billRate <= rate.payRate)
  const { overtime, holiday } = contract.multipliers
  const isIndefinite = contract.validTo === null
  const isValidRange = isIndefinite || (contract.validTo ?? '') > contract.validFrom
  const isExpired = !isIndefinite && (contract.validTo ?? '') < today

  const checks: ContractCheck[] = [
    {
      id: 'rates',
      status: rates.length === 0 ? 'fail' : 'ok',
      title: 'Tiene al menos una posición cotizada',
      detail:
        rates.length === 0
          ? 'Sin tarifas no se puede activar: agrega la primera con «Editar tarifas».'
          : `${String(rates.length)} ${rates.length === 1 ? 'posición cotizada' : 'posiciones cotizadas'}: cada una con su pay rate y bill rate.`,
    },
    {
      id: 'margin',
      status: badMargin.length > 0 ? 'fail' : rates.length === 0 ? 'pending' : 'ok',
      title: 'Cada posición deja margen',
      detail:
        badMargin.length > 0
          ? `El bill rate debe ser mayor que el pay rate: revisa ${badMargin.map((rate) => rate.positionName).join(', ')}.`
          : 'El bill rate es mayor que el pay rate en todas las posiciones: la diferencia es el margen de Oranje.',
    },
    {
      id: 'multipliers',
      status: overtime.bill < overtime.pay || holiday.bill < holiday.pay ? 'fail' : 'ok',
      title: 'Overtime y festivo no comen el margen',
      detail: `Overtime ${overtime.pay.toFixed(2)}× / ${overtime.bill.toFixed(2)}× · Festivo ${holiday.pay.toFixed(2)}× / ${holiday.bill.toFixed(2)}× (pago / factura). El de factura nunca va por debajo del de pago.`,
    },
    {
      id: 'validity',
      status: !isValidRange ? 'fail' : isExpired ? 'fail' : 'ok',
      title: 'La vigencia está bien definida',
      detail: !isValidRange
        ? 'La fecha de fin es anterior al inicio: corrige el rango.'
        : isExpired
          ? 'La fecha de fin ya pasó: este contrato debe marcarse expirado.'
          : isIndefinite
            ? 'Vigente desde el inicio, sin fecha de fin: aplica hasta que se expire a mano.'
            : 'Inicio y fin definidos: la nómina toma lo que regía cada día.',
    },
    {
      id: 'signer',
      status: contract.signedByName === '—' ? 'pending' : 'ok',
      title: 'Consta quién firmó por el hotel',
      detail:
        contract.signedByName === '—'
          ? 'El firmante aún no está registrado: se captura en la ficha del hotel.'
          : `Firmado por ${contract.signedByName}.`,
    },
  ]
  return checks
}

const STATUS_STYLE: Record<CheckStatus, { icon: string; iconClass: string; label: string }> = {
  ok: { icon: 'check_circle', iconClass: 'bg-green/15 text-green', label: 'Correcto' },
  pending: {
    icon: 'schedule',
    iconClass: 'bg-st-azul-claro/20 text-st-azul-claro',
    label: 'Pendiente',
  },
  fail: { icon: 'warning', iconClass: 'bg-yellow/25 text-o-700', label: 'Con problema' },
}

export function ContractChecklist({ contract }: { contract: ContractDetail }): ReactNode {
  /* Un contrato cerrado ya no tiene nada que verificar: decirlo vale más que siete palomitas. */
  if (contract.status === 'EXPIRED' || contract.status === 'CANCELLED') {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Sin verificación pendiente</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          {contract.status === 'EXPIRED'
            ? 'Este contrato ya expiró: dejó de regir y no admite cambios. Para renovar, se crea uno nuevo para el hotel.'
            : 'Este contrato se canceló en borrador: nunca rigió y no admite cambios.'}
        </p>
      </section>
    )
  }

  const checks = buildContractChecks(contract)
  const pending = checks.filter((check) => check.status === 'pending').length
  const failing = checks.filter((check) => check.status === 'fail').length

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-ink">Lista de verificación</h2>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">
          {checks.length}
        </span>
      </div>

      {/* Los dos contadores de la referencia: lo que falta y lo que está mal. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-st-azul-claro/15 px-4 py-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-st-azul-claro/25 text-st-azul-claro">
            <MaterialIcon name="schedule" className="text-xl" />
          </span>
          <span className="text-sm font-semibold text-ink">
            {pending} {pending === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </div>
        <div
          className={cn(
            'flex flex-col items-center gap-2 rounded-2xl px-4 py-5 text-center',
            failing > 0 ? 'bg-yellow/20' : 'bg-green/10',
          )}
        >
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-full',
              failing > 0 ? 'bg-yellow/40 text-o-700' : 'bg-green/20 text-green',
            )}
          >
            <MaterialIcon name={failing > 0 ? 'warning' : 'check_circle'} className="text-xl" />
          </span>
          <span className="text-sm font-semibold text-ink">
            {failing > 0
              ? `${String(failing)} con ${failing === 1 ? 'problema' : 'problemas'}`
              : 'Sin problemas'}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {checks.map((check) => {
          const style = STATUS_STYLE[check.status]
          return (
            <li
              key={check.id}
              className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  style.iconClass,
                )}
                title={style.label}
              >
                <MaterialIcon name={style.icon} className="text-lg" />
                <span className="sr-only">{style.label}</span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{check.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-3">{check.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

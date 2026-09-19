import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
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

/** El `i18n` viene del componente que la llama (D-36). */
export function buildContractChecks(contract: ContractDetail, i18n: I18n): ContractCheck[] {
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
      title: i18n._(msg`Tiene al menos una posición cotizada`),
      detail:
        rates.length === 0
          ? i18n._(msg`Sin tarifas no se puede activar: agrega la primera con «Editar tarifas».`)
          : rates.length === 1
            ? i18n._(msg`1 posición cotizada, con su pay rate y su bill rate.`)
            : i18n._(
                msg`${String(rates.length)} posiciones cotizadas: cada una con su pay rate y su bill rate.`,
              ),
    },
    {
      id: 'margin',
      status: badMargin.length > 0 ? 'fail' : rates.length === 0 ? 'pending' : 'ok',
      title: i18n._(msg`Cada posición deja margen`),
      detail:
        badMargin.length > 0
          ? i18n._(
              msg`El bill rate debe ser mayor que el pay rate: revisa ${badMargin.map((rate) => rate.positionName).join(', ')}.`,
            )
          : i18n._(
              msg`El bill rate es mayor que el pay rate en todas las posiciones: la diferencia es el margen de Oranje.`,
            ),
    },
    {
      id: 'multipliers',
      status: overtime.bill < overtime.pay || holiday.bill < holiday.pay ? 'fail' : 'ok',
      title: i18n._(msg`Overtime y festivo no comen el margen`),
      detail: i18n._(
        msg`Overtime ${overtime.pay.toFixed(2)}× / ${overtime.bill.toFixed(2)}× · Festivo ${holiday.pay.toFixed(2)}× / ${holiday.bill.toFixed(2)}× (pago / factura). El de factura nunca va por debajo del de pago.`,
      ),
    },
    {
      id: 'validity',
      status: !isValidRange ? 'fail' : isExpired ? 'fail' : 'ok',
      title: i18n._(msg`La vigencia está bien definida`),
      detail: !isValidRange
        ? i18n._(msg`La fecha de fin es anterior al inicio: corrige el rango.`)
        : isExpired
          ? i18n._(msg`La fecha de fin ya pasó: este contrato debe marcarse expirado.`)
          : isIndefinite
            ? i18n._(
                msg`Vigente desde el inicio, sin fecha de fin: aplica hasta que se expire a mano.`,
              )
            : i18n._(msg`Inicio y fin definidos: la nómina toma lo que regía cada día.`),
    },
    {
      id: 'signer',
      status: contract.signedByName === '—' ? 'pending' : 'ok',
      title: i18n._(msg`Consta quién firmó por el hotel`),
      detail:
        contract.signedByName === '—'
          ? i18n._(msg`El firmante aún no está registrado: se captura en la ficha del hotel.`)
          : i18n._(msg`Firmado por ${contract.signedByName}.`),
    },
  ]
  return checks
}

/** El `label` se traduce al pintar con `i18n._()` (D-36). */
const STATUS_STYLE: Record<
  CheckStatus,
  { icon: string; iconClass: string; label: MessageDescriptor }
> = {
  ok: { icon: 'check_circle', iconClass: 'bg-green/15 text-green', label: msg`Correcto` },
  pending: {
    icon: 'schedule',
    iconClass: 'bg-st-azul-claro/20 text-st-azul-claro',
    label: msg`Pendiente`,
  },
  fail: { icon: 'warning', iconClass: 'bg-yellow/25 text-o-700', label: msg`Con problema` },
}

export function ContractChecklist({ contract }: { contract: ContractDetail }): ReactNode {
  const { i18n } = useLingui()

  /* Un contrato cerrado ya no tiene nada que verificar: decirlo vale más que siete palomitas. */
  if (contract.status === 'EXPIRED' || contract.status === 'CANCELLED') {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">
          <Trans>Sin verificación pendiente</Trans>
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          {contract.status === 'EXPIRED' ? (
            <Trans>
              Este contrato ya expiró: dejó de regir y no admite cambios. Para renovar, se crea uno
              nuevo para el hotel.
            </Trans>
          ) : (
            <Trans>Este contrato se canceló en borrador: nunca rigió y no admite cambios.</Trans>
          )}
        </p>
      </section>
    )
  }

  const checks = buildContractChecks(contract, i18n)
  const pending = checks.filter((check) => check.status === 'pending').length
  const failing = checks.filter((check) => check.status === 'fail').length

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-ink">
          <Trans>Lista de verificación</Trans>
        </h2>
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
            <Plural value={pending} one="# pendiente" other="# pendientes" />
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
            {failing > 0 ? (
              <Plural value={failing} one="# con problema" other="# con problemas" />
            ) : (
              <Trans>Sin problemas</Trans>
            )}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {checks.map((check) => {
          const style = STATUS_STYLE[check.status]
          const styleLabel = i18n._(style.label)
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
                title={styleLabel}
              >
                <MaterialIcon name={style.icon} className="text-lg" />
                <span className="sr-only">{styleLabel}</span>
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

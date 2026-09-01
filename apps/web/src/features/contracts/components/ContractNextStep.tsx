import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ContractDetail } from '../types/contract.types'

import { buildContractChecks } from './ContractChecklist'

import { formatDate } from '@/shared/lib/formatters'

/**
 * «¿Qué sigue?»: al terminar un paso, la pantalla dice cuál es el siguiente,
 * quién lo hace y qué se espera — en vez de dejar a la persona adivinando si
 * ya acabó. Depende del estado del contrato; nada de listas de palomitas.
 */
export function ContractNextStep({
  contract,
  activeContractNumber = null,
}: {
  contract: ContractDetail
  /** El contrato VIGENTE del mismo hotel, si existe otro: activar este exige expirarlo. */
  activeContractNumber?: string | null
}): ReactNode {
  const failing = buildContractChecks(contract).filter((check) => check.status === 'fail')

  const step =
    contract.status === 'DRAFT'
      ? {
          icon: 'edit_note',
          title: 'Siguiente paso: activar el contrato',
          who: 'Lo haces tú, desde este mismo lugar (Ventas).',
          detail:
            failing.length > 0
              ? `Antes hay que resolver: ${failing.map((check) => check.title.toLowerCase()).join(' · ')}.`
              : 'Las tarifas ya están completas. Al activarlo, la nómina y la factura del hotel empiezan a usarlo y no se puede volver a editar.',
          then: activeContractNumber
            ? `Ojo: el ${activeContractNumber} sigue vigente para este hotel — solo puede haber uno activo, así que al activar este hay que expirar aquel.`
            : 'Después: nadie más aprueba. El contrato queda vigente y el hotel puede pedir personal con estas tarifas.',
        }
      : contract.status === 'ACTIVE'
        ? {
            icon: 'verified',
            title: 'Contrato vigente: no hay nada pendiente',
            who: 'Lo usan Contabilidad y el hotel cada semana, sin que tengas que hacer nada.',
            detail:
              contract.validTo === null
                ? 'No tiene fecha de fin: rige hasta que alguien lo marque expirado.'
                : `Vence el ${formatDate(contract.validTo)}. Para renovar, crea un contrato nuevo antes de esa fecha y marca este como expirado.`,
            then: 'Si cambian las tarifas, no se edita este: se crea uno nuevo con vigencia propia, para que las semanas ya pagadas no se recalculen.',
          }
        : contract.status === 'EXPIRED'
          ? {
              icon: 'history',
              title: 'Contrato expirado: dejó de regir',
              who: 'Nadie tiene que hacer nada con este documento.',
              detail: 'Se conserva como historial: las semanas que rigió se calcularon con él.',
              then: `Si ${contract.hotelName} sigue siendo cliente, lo que sigue es crear un contrato nuevo.`,
            }
          : {
              icon: 'block',
              title: 'Borrador cancelado: nunca rigió',
              who: 'Nadie tiene que hacer nada con este documento.',
              detail: 'Se conserva como historial y no admite cambios.',
              then: `Si ${contract.hotelName} necesita contrato, crea uno nuevo desde «Agregar contrato».`,
            }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-o-50 text-o-700">
          <MaterialIcon name={step.icon} className="text-xl" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{step.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{step.detail}</p>
        </div>
      </div>
      <dl className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-sm">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-3">Quién</dt>
          <dd className="text-ink-2">{step.who}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-3">Después</dt>
          <dd className="text-ink-2">{step.then}</dd>
        </div>
      </dl>
    </section>
  )
}

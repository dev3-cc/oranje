import type { ReactNode } from 'react'

/**
 * Las restricciones que la base impone al contrato.
 *
 * Son las mismas para todos, así que no vienen del backend: están escritas
 * aquí. Se muestran a propósito —con el nombre real de cada constraint— porque
 * quien edita un contrato choca contra ellas, y un error de base sin traducir
 * no le dice a nadie qué hizo mal.
 */
const RULES = [
  {
    name: 'ux_contract_active',
    detail:
      'Un solo contrato ACTIVE por hotel. Para renovar hay que pasar el vigente a EXPIRED en la misma transacción.',
  },
  {
    name: 'ck_contract_multiplier_margin',
    detail:
      'El multiplicador que se factura nunca puede ser menor al que se paga — ni en overtime ni en festivo.',
  },
  {
    name: 'ck_contract_rate_margin',
    detail:
      'Lo mismo por posición: bill_rate ≥ pay_rate. No se puede cotizar por debajo del costo.',
  },
  {
    name: 'ck_contract_week',
    detail: 'week_start_day y week_end_day van de 0 a 6 y no pueden ser el mismo día.',
  },
  {
    name: 'ck_contract_validity',
    detail: 'valid_to tiene que ser posterior a valid_from, o quedar nulo si es indefinido.',
  },
]

export function EngineRulesCard(): ReactNode {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-ink">Lo que el motor no deja pasar</h2>

      <dl className="mt-5 flex flex-col gap-5">
        {RULES.map((rule) => (
          <div key={rule.name}>
            <dt className="font-mono text-sm font-semibold text-o-700">{rule.name}</dt>
            <dd className="mt-1 text-sm text-ink-3">{rule.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

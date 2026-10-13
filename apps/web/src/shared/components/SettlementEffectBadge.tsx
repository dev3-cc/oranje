import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { SettlementEffect } from '@/features/recruitment'

/** Quién pagó el gasto (Hugo, 2026-10-09): sin color sola, cada una lleva su
    propia etiqueta — lo que importa es qué le toca al pago del colaborador.
    Compartido entre la cola del Observador y la de Contabilidad: es el mismo
    hecho visto por dos roles distintos. */
const SETTLEMENT_EFFECT_BADGE: Record<
  SettlementEffect,
  { icon: string; label: MessageDescriptor; className: string }
> = {
  COMPANY_EXPENSE: {
    icon: 'domain',
    label: msg`Gasto de Oranje`,
    className: 'border border-line text-ink-3',
  },
  REIMBURSE: {
    icon: 'account_balance_wallet',
    label: msg`Reembolso: se le suma`,
    className: 'bg-green/10 text-green',
  },
  PAYROLL_DEDUCTION: {
    icon: 'remove_circle_outline',
    label: msg`Descuento: se le resta`,
    className: 'bg-red/10 text-red',
  },
}

export function SettlementEffectBadge({ effect }: { effect: SettlementEffect }): ReactNode {
  const { i18n } = useLingui()
  const config = SETTLEMENT_EFFECT_BADGE[effect]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      <MaterialIcon name={config.icon} className="text-sm" aria-hidden />
      {i18n._(config.label)}
    </span>
  )
}

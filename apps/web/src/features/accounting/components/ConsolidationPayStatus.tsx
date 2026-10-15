import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { useGetConsolidationsQuery } from '../api/settlementApi'
import {
  CONSOLIDATION_STATUS_LABEL,
  CONSOLIDATION_STATUS_TOKEN,
  type ConsolidationStatus,
} from '../types/settlement.constants'

import { PayConsolidationButton } from './PayConsolidationButton'

// eslint-disable-next-line no-restricted-imports
import { diffDaysIso, todayIso } from '@/features/timesheet/lib/weekNavigation'
// eslint-disable-next-line no-restricted-imports
import type { TimesheetRow } from '@/features/timesheet/types/timesheet.types'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { useCan } from '@/shared/hooks/useCan'

/**
 * Junto al `WeekActionBar` de la misma persona (Hugo, 2026-10-14: la misma
 * lista deslizante y el mismo panel de detalle que ya usa Mi Personal — no
 * una tabla aparte): a quien tiene `payroll:mark_paid` le dice si el
 * Consolidado de esa semana lleva atraso, y le deja Registrar el pago si ya
 * está Autorizado. A nadie más se le dibuja nada.
 *
 * Un Timesheet (colaborador × requisición × semana) y un Consolidado
 * (colaborador × HOTEL × semana) son entidades distintas — el segundo nace
 * solo con la corrida de pago, así que puede no existir todavía. Se
 * empareja por colaborador + semana, sin el hotel: Contabilidad no siempre
 * puede resolver el nombre del hotel del Timesheet (2026-10-14), y con más
 * de un Consolidado la misma semana no se adivina cuál — se dice que hay
 * varios en vez de arriesgar pagar el que no es.
 */
export function ConsolidationPayStatus({
  row,
  selectedWeek,
}: {
  row: TimesheetRow
  selectedWeek: string
}): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const canMarkPaid = can('payroll:mark_paid')
  const { data: consolidations } = useGetConsolidationsQuery(undefined, { skip: !canMarkPaid })

  if (!canMarkPaid) return null

  const matches = (consolidations ?? []).filter(
    (c) => c.worker.id === row.workerId && c.weekStart === selectedWeek,
  )
  const ambiguous = matches.length > 1
  const consolidation = matches.length === 1 ? matches[0] : undefined

  if (ambiguous) {
    return (
      <span
        className="rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-3"
        title={t`Trabajó en más de un hotel esta semana: cada Consolidado se paga por separado, desde su propia ficha.`}
      >
        {t`${matches.length} Consolidados esta semana`}
      </span>
    )
  }

  /* Sin Consolidado, sin insignia — la ausencia ES la señal (Hugo,
     2026-10-15: "quita eso de consolidado sin generar"). Antes el aviso
     punteado salía con solo que la semana hubiera EMPEZADO (comparaba contra
     `selectedWeek`, el lunes), así que se veía para una semana en curso que
     nadie había tenido tiempo de cerrar — parecía un error sin serlo. En
     cuanto Contabilidad corre "Cerrar semana" nace el Consolidado en
     Borrador y la insignia de abajo aparece sola. */
  if (!consolidation) return null

  if (consolidation.status === 'AUTHORIZED') {
    const today = todayIso()
    const daysLate =
      consolidation.weekEnd < today ? diffDaysIso(consolidation.weekEnd, today) : null
    return (
      <div className="flex items-center gap-2">
        {daysLate !== null && (
          <span className="text-xs font-semibold text-red">
            {t`${plural(daysLate, { one: '# día de atraso', other: '# días de atraso' })}`}
          </span>
        )}
        <PayConsolidationButton
          consolidationId={consolidation.id}
          workerName={row.workerName}
          netAmount={consolidation.netAmount}
          compact
        />
      </div>
    )
  }

  return (
    <StatusLightSoftBadge
      token={CONSOLIDATION_STATUS_TOKEN[consolidation.status as ConsolidationStatus] ?? 'st-gris'}
      label={
        CONSOLIDATION_STATUS_LABEL[consolidation.status as ConsolidationStatus] ??
        consolidation.status
      }
    />
  )
}

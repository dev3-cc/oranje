import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { DepartmentMetric } from '../types/observability.types'

import type { Kpi } from './kpi'

/**
 * `department-metrics` cuenta los accidentes por su `status` crudo. Estos son
 * los de `ACCIDENT_STATUSES` del API; uno desconocido se enseña tal cual.
 */
export const ACCIDENT_STATUS_LABEL: Record<string, MessageDescriptor> = {
  REPORTED: msg`Reportado`,
  ON_SITE_CAPTURED: msg`Capturado en sitio`,
  MEDICAL_FOLLOW_UP: msg`Seguimiento médico`,
  CLOSED: msg`Cerrado`,
}

/** Consolidados de nómina por `status` crudo, del servicio de consolidaciones. */
export const CONSOLIDATION_STATUS_LABEL: Record<string, MessageDescriptor> = {
  DRAFT: msg`Borrador`,
  VALIDATED: msg`Validado`,
  AUTHORIZED: msg`Autorizado`,
  PAID: msg`Pagado`,
}

export function inspectionKpis(inspection: DepartmentMetric | undefined): Kpi[] {
  const open = inspection
    ? inspection.counts
        .filter((count) => count.label !== 'CLOSED')
        .reduce((sum, count) => sum + count.count, 0)
    : null
  return [
    {
      id: 'inspectionOpenAccidents',
      label: msg`Tarjetas de accidente abiertas`,
      hint: msg`Accidentes que todavía no se cierran, de todos los hoteles.`,
      format: 'count',
      scope: 'NOW',
      value: open,
      ...(open === null ? { empty: 'NO_DATA' as const } : {}),
    },
  ]
}

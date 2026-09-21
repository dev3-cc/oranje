import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Badge,
  MaterialIcon,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  UiButton,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { useGetPunchesQuery } from '../api/observabilityApi'
import type { Punch } from '../types/observability.types'

import { formatDayMonthTime, formatTimeIn } from '@/shared/lib/formatters'
import { labelMap } from '@/shared/lib/i18nLabels'

const PAGE_SIZE = 20

/** Mismos 4 tipos de marca de `operations.punch_mark` (`PunchMark.type`). */
const PUNCH_TYPE_LABEL = labelMap({
  CLOCK_IN: msg`Entrada`,
  LUNCH_OUT: msg`Salida a lunch`,
  LUNCH_IN: msg`Regreso de lunch`,
  CLOCK_OUT: msg`Salida`,
})

/**
 * Solo para CLOCK_IN con turno programado ese día — el número crudo de
 * minutos, sin tolerancia inventada: quien mira decide qué tan tarde es
 * "tarde" (Hugo, 2026-09-21: "no puedo ver si las personas están ponchando
 * en tiempo").
 */
function PunctualityCell({ punch }: { punch: Punch }) {
  const { t } = useLingui()

  if (punch.type !== 'CLOCK_IN' || punch.scheduledStart === null || punch.lateMinutes === null) {
    return <span className="text-ink-3">—</span>
  }

  const scheduled = formatTimeIn(punch.scheduledStart)

  if (punch.lateMinutes > 0) {
    return (
      <Badge variant="destructive" title={t`Turno ${scheduled}`}>
        {t`+${punch.lateMinutes} min`}
      </Badge>
    )
  }
  if (punch.lateMinutes === 0) {
    return (
      <Badge variant="secondary" title={t`Turno ${scheduled}`}>
        <Trans>A tiempo</Trans>
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" title={t`Turno ${scheduled}`}>
      {t`${Math.abs(punch.lateMinutes)} min antes`}
    </Badge>
  )
}

export function PunchesTable(): ReactNode {
  const { t } = useLingui()
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching } = useGetPunchesQuery({ page, limit: PAGE_SIZE })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Trans>Hora</Trans>
            </TableHead>
            <TableHead>
              <Trans>Hotel</Trans>
            </TableHead>
            <TableHead>
              <Trans>Colaborador</Trans>
            </TableHead>
            <TableHead>
              <Trans>Marca</Trans>
            </TableHead>
            <TableHead>
              <Trans>Puntualidad</Trans>
            </TableHead>
            <TableHead>
              <Trans>Evidencia</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.data ?? []).map((punch) => (
            <TableRow key={punch.id}>
              <TableCell className="whitespace-nowrap">
                {formatDayMonthTime(punch.serverAt)}
              </TableCell>
              <TableCell>{punch.hotelName}</TableCell>
              <TableCell>{punch.workerFullName}</TableCell>
              <TableCell>{PUNCH_TYPE_LABEL[punch.type] ?? punch.type}</TableCell>
              <TableCell>
                <PunctualityCell punch={punch} />
              </TableCell>
              <TableCell>
                {punch.isManual ? (
                  <Badge variant="outline">
                    <Trans>Manual</Trans>
                  </Badge>
                ) : punch.insideGeofence === false ? (
                  <Badge variant="destructive">
                    <Trans>Fuera de geocerca</Trans>
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Trans>Dentro de geocerca</Trans>
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(data?.data.length ?? 0) === 0 && (
        <p className="py-6 text-center text-sm text-ink-3">
          <Trans>Todavía no hay ponches registrados.</Trans>
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-ink-3">
        <span>
          <Trans>
            Página {page} de {data?.meta.totalPages ?? 1} · {data?.meta.total ?? 0} ponches
          </Trans>
        </span>
        <div className="flex gap-2">
          <UiButton
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label={t`Página anterior`}
          >
            <MaterialIcon name="chevron_left" />
          </UiButton>
          <UiButton
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= (data?.meta.totalPages ?? 1) || isFetching}
            onClick={() => setPage((p) => p + 1)}
            aria-label={t`Página siguiente`}
          >
            <MaterialIcon name="chevron_right" />
          </UiButton>
        </div>
      </div>
    </div>
  )
}

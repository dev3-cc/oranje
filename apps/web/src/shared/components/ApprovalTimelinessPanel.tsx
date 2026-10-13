import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ApprovalTimeliness, TimelinessLevel } from '@/shared/types/approvalTimeliness.types'

const DOT: Record<TimelinessLevel, string> = {
  GREEN: 'bg-[var(--green)]',
  YELLOW: 'bg-[var(--yellow)]',
  RED: 'bg-[var(--red)]',
}

/**
 * KPI 4 · Aprobación oportuna de ponches. Lo pintan Observabilidad y
 * Contabilidad con el mismo dato: el cálculo vive solo en el API.
 */
export function ApprovalTimelinessPanel({ data }: { data: ApprovalTimeliness }): ReactNode {
  const { t } = useLingui()

  const names: Record<TimelinessLevel, string> = {
    GREEN: t`Verde`,
    YELLOW: t`Amarillo`,
    RED: t`Rojo`,
  }

  const levelCell = (level: TimelinessLevel | null): ReactNode =>
    level === null ? (
      <span className="text-ink-4">—</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
        <span aria-hidden className={`size-2.5 rounded-full ${DOT[level]}`} />
        {names[level]}
      </span>
    )

  const percent = (value: number | null): string => (value === null ? '—' : `${value}%`)

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Aprobación oportuna de ponches</Trans>
        </h2>
        <p className="mt-1 text-sm text-ink-3">
          <Trans>
            Porcentaje de ponches de cada semana cerrada que el Manager de Área aprobó antes del
            cierre. Verde desde {data.thresholds.green}%, amarillo desde {data.thresholds.yellow}%,
            rojo por debajo. Últimas {data.weeks} semanas.
          </Trans>
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t`Del periodo`} value={percent(data.overall.punches.percentage)} />
        <Stat
          label={t`Nivel`}
          value={data.overall.punches.level ? names[data.overall.punches.level] : '—'}
        />
        <Stat label={t`Hojas sin aprobar`} value={String(data.overall.timesheets.pending)} />
        <Stat
          label={t`Días de atraso (prom.)`}
          value={data.overall.avgDaysLate === null ? '—' : String(data.overall.avgDaysLate)}
        />
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <Table className="min-w-[40rem] text-left">
          <TableHeader>
            <TableRow className="border-line">
              {[
                t`Hotel`,
                t`Ponches a tiempo`,
                t`Nivel`,
                t`Tarde`,
                t`Pendientes`,
                t`Días de atraso`,
              ].map((header) => (
                <TableHead key={header} className="text-xs font-semibold text-ink-3">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byHotel.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-ink-3">
                  <Trans>Sin semanas cerradas en el periodo.</Trans>
                </TableCell>
              </TableRow>
            )}
            {data.byHotel.map((row) => (
              <TableRow key={row.hotelId} className="border-line">
                <TableCell className="text-sm font-medium text-ink">{row.hotelName}</TableCell>
                <TableCell className="text-sm text-ink-2">
                  {percent(row.punches.percentage)}
                </TableCell>
                <TableCell>{levelCell(row.punches.level)}</TableCell>
                <TableCell className="text-sm text-ink-2">{row.timesheets.late}</TableCell>
                <TableCell className="text-sm text-ink-2">{row.timesheets.pending}</TableCell>
                <TableCell className="text-sm text-ink-2">
                  {row.avgDaysLate === null ? '—' : String(row.avgDaysLate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <Table className="min-w-[48rem] text-left">
          <TableHeader>
            <TableRow className="border-line">
              {[
                t`Hotel`,
                t`Departamento`,
                t`Manager de Área`,
                t`Ponches a tiempo`,
                t`Nivel`,
                t`Pendientes`,
              ].map((header) => (
                <TableHead key={header} className="text-xs font-semibold text-ink-3">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byManager.map((row) => (
              <TableRow
                key={`${row.hotelId}-${row.departmentId ?? 'none'}`}
                className="border-line"
              >
                <TableCell className="text-sm text-ink">{row.hotelName}</TableCell>
                <TableCell className="text-sm text-ink-2">{row.departmentName ?? '—'}</TableCell>
                <TableCell className="text-sm text-ink-2">
                  {row.managers.length === 0
                    ? t`Sin Manager de Área`
                    : row.managers.map((m) => m.fullName).join(', ')}
                </TableCell>
                <TableCell className="text-sm text-ink-2">
                  {percent(row.punches.percentage)}
                </TableCell>
                <TableCell>{levelCell(row.punches.level)}</TableCell>
                <TableCell className="text-sm text-ink-2">{row.timesheets.pending}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  )
}

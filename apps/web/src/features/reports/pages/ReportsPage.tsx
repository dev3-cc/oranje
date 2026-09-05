import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetSalesReportQuery } from '../api/reportsApi'

import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  CONTACT_ATTEMPT_OUTCOME_LABEL,
  CONTACT_ATTEMPT_TYPE_LABEL,
  type ContactAttemptOutcome,
  type ContactAttemptType,
} from '@/shared/constants/contactAttempt'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatPercent } from '@/shared/lib/formatters'

const REPORT_TABS = ['Ventas', 'Pipeline', 'Desempeño', 'Calidad', 'Ejecutivo'] as const

export function ReportsPage(): ReactNode {
  const { data: report, isLoading, isError, refetch } = useGetSalesReportQuery()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Reportes" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            Análisis con historia; el pulso de hoy vive en el Dashboard
          </p>
        </div>
        {}
        <Button variant="secondary" disabled title="El envío recurrente llega pronto">
          Programar envío recurrente
        </Button>
      </header>

      {/* Solo Ventas existe: el tablist lo dice con `aria-selected`, y los otros
          cuatro están deshabilitados de verdad — ni cursor ni hover que prometan
          un reporte que aún no se define. */}
      <div role="tablist" aria-label="Reporte" className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab, index) => {
          const isCurrent = index === 0
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              disabled={!isCurrent}
              title={isCurrent ? undefined : 'Este reporte aún no se define'}
              className={
                isCurrent
                  ? 'rounded-full bg-o-500 px-4 py-2 text-sm font-semibold text-ink'
                  : 'rounded-full border border-line px-4 py-2 text-sm text-ink-3 disabled:cursor-not-allowed disabled:opacity-50'
              }
            >
              {tab}
            </button>
          )
        })}
      </div>

      {isError && (
        <LoadError
          message="No se pudo armar el reporte. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !report ? (
        <CardGridSkeleton cards={4} className="grid-cols-1 xl:grid-cols-2" />
      ) : (
        report && (
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <SectionCard
              title="Conversión por BD"
              subtitle={
                IS_DEV_UI
                  ? 'ciclos abiertos vs convertidos · prospect_state_history'
                  : 'quién convierte y en cuánto tiempo'
              }
            >
              <Table className="text-left">
                <TableHeader>
                  <TableRow className="border-line text-xs tracking-wide text-ink-3 uppercase">
                    <TableHead className="py-2 pr-2 pl-0 font-bold text-ink-3">BD</TableHead>
                    <TableHead className="px-2 py-2 font-bold text-ink-3">Abiertos</TableHead>
                    <TableHead className="px-2 py-2 font-bold text-ink-3">Convertidos</TableHead>
                    <TableHead className="px-2 py-2 font-bold text-ink-3">Tasa</TableHead>
                    <TableHead className="py-2 pr-0 pl-2 font-bold text-ink-3">
                      Días prom.
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.conversionByBd.map((row) => (
                    <TableRow key={row.id} className="border-line">
                      <TableCell className="py-2.5 pr-2 pl-0 text-sm font-semibold whitespace-normal text-ink">
                        {row.fullName}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-sm text-ink-2">{row.open}</TableCell>
                      <TableCell className="px-2 py-2.5 text-sm text-ink-2">
                        {row.converted}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-sm text-ink-2">
                        {formatPercent(row.rate)}
                      </TableCell>
                      <TableCell className="py-2.5 pr-0 pl-2 text-sm text-ink-2">
                        {row.averageDays === null ? '—' : `${String(row.averageDays)} d`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-sm text-ink-3">
                Total del equipo: {report.teamTotals.open} abiertos · {report.teamTotals.converted}{' '}
                convertidos · {formatPercent(report.teamTotals.rate)}
                {report.teamTotals.averageDays !== null &&
                  ` · ${String(report.teamTotals.averageDays)} d`}
              </p>
            </SectionCard>

            <SectionCard
              title="Tiempo por color del semáforo"
              subtitle="días promedio en cada estado · dónde se atora el pipeline"
            >
              <ul className="flex flex-col gap-2.5">
                {report.timeInState.map((item) => (
                  <li key={item.status} className="flex items-center justify-between gap-3">
                    <StatusLightSoftBadge
                      token={ONBOARDING_STATUS_TOKEN[item.status]}
                      label={ONBOARDING_STATUS_LABEL[item.status]}
                    />
                    <span className="text-sm font-semibold text-ink">
                      {item.averageDays === null ? '—' : `${String(item.averageDays)} d`}
                    </span>
                  </li>
                ))}
              </ul>
              {report.bottleneck && (
                <p className="mt-3 rounded-md bg-yellow/15 px-3 py-2 text-sm text-ink-2">
                  El cuello está en {ONBOARDING_STATUS_LABEL[report.bottleneck.status]}:{' '}
                  {String(report.bottleneck.averageDays)} d promedio antes de salir
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Intentos por canal × resultado"
              subtitle={
                IS_DEV_UI ? 'contact_attempt.attempt_type × outcome' : 'qué canal sí logra contacto'
              }
            >
              {report.attempts.channels.length === 0 ? (
                <p className="text-sm text-ink-3">
                  Sin intentos registrados todavía. Se llenan desde la bitácora de cada prospecto.
                </p>
              ) : (
                <Table className="text-left">
                  <TableHeader>
                    <TableRow className="border-line text-xs tracking-wide text-ink-3 uppercase">
                      <TableHead className="py-2 pr-2 pl-0 font-bold text-ink-3">
                        Resultado
                      </TableHead>
                      {report.attempts.channels.map((channel) => (
                        <TableHead key={channel} className="px-2 py-2 font-bold text-ink-3">
                          {CONTACT_ATTEMPT_TYPE_LABEL[channel as ContactAttemptType] ?? channel}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.attempts.rows.map((row) => (
                      <TableRow key={row.outcome} className="border-line">
                        <TableCell className="py-2.5 pr-2 pl-0 text-sm font-semibold whitespace-normal text-ink">
                          {CONTACT_ATTEMPT_OUTCOME_LABEL[row.outcome as ContactAttemptOutcome] ??
                            row.outcome}
                        </TableCell>
                        {row.counts.map((count, index) => (
                          <TableCell
                            key={report.attempts.channels[index]}
                            className="px-2 py-2.5 text-sm text-ink-2"
                          >
                            {count}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            <SectionCard
              title="Motivos de salida a Rojo · Café · Negro"
              subtitle={
                IS_DEV_UI
                  ? 'prospect_state_history.reason_id'
                  : 'por qué se van los ciclos, y que son reactivables'
              }
            >
              {report.exitReasons.length === 0 ? (
                <p className="text-sm text-ink-3">
                  Sin salidas registradas todavía. Ningún ciclo se ha ido a Rojo, Café o Negro.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {report.exitReasons.map((reason) => (
                    <li key={reason.label} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-2">{reason.label}</span>
                      <span className="text-sm font-semibold text-ink">{reason.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-sm text-ink-3">
                {report.exits.total} salidas · Rojo {report.exits.red} · Café {report.exits.brown} ·
                Negro {report.exits.black} — reactivables a Azul claro
                {IS_DEV_UI ? ' (RR-V-07)' : ''}
              </p>
            </SectionCard>
          </div>
        )
      )}
    </div>
  )
}

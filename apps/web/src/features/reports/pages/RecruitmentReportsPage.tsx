import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetHotelCoverageQuery } from '../api/recruitmentReportsApi'

import { useGetRecruitmentTeamQuery } from '@/features/team'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { SectionCard } from '@/shared/components/SectionCard'
import { downloadCsv, todayForFileName } from '@/shared/lib/csv'
import { formatDayMonth } from '@/shared/lib/formatters'

/**
 * Los reportes de la Manager de Reclutamiento: el trabajo de su equipo y la
 * cobertura de las requisiciones del departamento, los dos descargables. Los
 * reportes que le mandan sus Líderes llegan con la pantalla Mi Grupo, que
 * todavía no existe; se dice en vez de dejar un hueco.
 */
export function RecruitmentReportsPage(): ReactNode {
  const { t } = useLingui()
  const team = useGetRecruitmentTeamQuery()
  const coverage = useGetHotelCoverageQuery()

  const downloadTeam = (): void => {
    downloadCsv(`desempeno-equipo-${todayForFileName()}.csv`, [
      [
        t`Persona`,
        t`Rol`,
        t`Reporta a`,
        t`Requisiciones que está llenando`,
        t`Requisiciones cubiertas`,
        t`Asignaciones (30 días)`,
        t`Altas (30 días)`,
        t`Por validar`,
        t`Última actividad`,
      ],
      ...(team.data ?? []).map((member) => [
        member.fullName,
        member.role.name,
        member.reportsTo?.fullName ?? '',
        member.activeRequisitions,
        member.coveredRequisitions,
        member.assignmentsLast30Days,
        member.workersCreatedLast30Days,
        member.pendingValidation,
        member.lastActivityAt ? member.lastActivityAt.slice(0, 10) : '',
      ]),
    ])
  }

  const downloadCoverage = (): void => {
    downloadCsv(`cobertura-por-hotel-${todayForFileName()}.csv`, [
      [
        t`Hotel`,
        t`En cola`,
        t`En proceso`,
        t`Cubiertas parcialmente`,
        t`Cubiertas totalmente`,
        t`Lugares cubiertos`,
        t`Lugares pedidos`,
      ],
      ...(coverage.data ?? []).map((row) => [
        row.hotelName,
        row.queued,
        row.inProgress,
        row.partial,
        row.covered,
        row.filledSlots,
        row.totalSlots,
      ]),
    ])
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Reportes`} />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>El trabajo de tu equipo y la cobertura de requisiciones, para descargar</Trans>
          </p>
        </div>
        <Button variant="secondary" disabled title={t`El envío recurrente llega pronto`}>
          <Trans>Programar envío recurrente</Trans>
        </Button>
      </header>

      {team.isLoading || coverage.isLoading ? (
        <CardGridSkeleton cards={2} className="grid-cols-1" />
      ) : (
        <>
          <SectionCard
            title={t`Desempeño del equipo`}
            subtitle={t`Por persona · asignaciones y altas de los últimos 30 días`}
            action={
              <Button
                variant="secondary"
                disabled={!team.data || team.data.length === 0}
                onClick={downloadTeam}
              >
                <Trans>Descargar CSV</Trans>
              </Button>
            }
          >
            {team.isError || !team.data ? (
              <LoadError
                message={t`No se pudo armar este reporte. Reintenta en unos segundos.`}
                onRetry={() => {
                  void team.refetch()
                }}
              />
            ) : team.data.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-3">
                <Trans>
                  Nadie te reporta todavía. Asigna tu equipo en Usuarios con «Reporta a».
                </Trans>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Trans>Persona</Trans>
                      </TableHead>
                      <TableHead>
                        <Trans>Reporta a</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Llenando</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Cubiertas</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Asignaciones · 30 d</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Altas · 30 d</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Por validar</Trans>
                      </TableHead>
                      <TableHead>
                        <Trans>Última actividad</Trans>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.data.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Link
                            to={`/my-team?persona=${member.id}`}
                            className="block font-medium text-ink hover:text-o-700 hover:underline"
                          >
                            {member.fullName}
                          </Link>
                          <span className="block text-xs text-ink-3">{member.role.name}</span>
                        </TableCell>
                        <TableCell className="text-ink-2">
                          {member.reportsTo?.fullName ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.activeRequisitions}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.coveredRequisitions}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.assignmentsLast30Days}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.workersCreatedLast30Days}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.pendingValidation}
                        </TableCell>
                        <TableCell className="text-ink-2">
                          {member.lastActivityAt ? formatDayMonth(member.lastActivityAt) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={t`Cobertura por hotel`}
            subtitle={t`Requisiciones por estado y lugares cubiertos; sin borradores ni eliminadas`}
            action={
              <Button
                variant="secondary"
                disabled={!coverage.data || coverage.data.length === 0}
                onClick={downloadCoverage}
              >
                <Trans>Descargar CSV</Trans>
              </Button>
            }
          >
            {coverage.isError || !coverage.data ? (
              <LoadError
                message={t`No se pudo armar este reporte. Reintenta en unos segundos.`}
                onRetry={() => {
                  void coverage.refetch()
                }}
              />
            ) : coverage.data.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-3">
                <Trans>Todavía no hay requisiciones autorizadas en ningún hotel.</Trans>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Trans>Hotel</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>En cola</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>En proceso</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Parciales</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Cubiertas</Trans>
                      </TableHead>
                      <TableHead className="text-right">
                        <Trans>Lugares cubiertos</Trans>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverage.data.map((row) => (
                      <TableRow key={row.hotelId}>
                        <TableCell className="font-medium text-ink">{row.hotelName}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.queued}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.inProgress}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.partial}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.covered}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t`${String(row.filledSlots)} de ${String(row.totalSlots)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <p className="text-sm text-ink-3">
            <Trans>
              Los reportes que te envían tus Líderes llegarán con su pantalla «Mi Grupo», que
              todavía no existe.
            </Trans>
          </p>
        </>
      )}
    </div>
  )
}

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetApprovalTimelinessQuery, useGetPendingApprovalsQuery } from '../api/settlementApi'

import personajeAyuda from '@/assets/ilustrations/personaje-ayuda.svg'
import personajeRechazado from '@/assets/ilustrations/personaje-pago-rechazado.svg'
import { ApprovalTimelinessPanel } from '@/shared/components/ApprovalTimelinessPanel'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatWeekRange } from '@/shared/lib/formatters'

/** El texto se traduce al pintar con `i18n._()` (D-36), como el resto de los intros. */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeRechazado,
    title: msg`Lo que no se aprueba, no se paga`,
    text: msg`Una semana cerrada sin aprobar no entra al Consolidado ni a la factura del hotel — queda en espera hasta que el Manager de Área la apruebe.`,
  },
  {
    image: personajeAyuda,
    title: msg`Esta pantalla dice a quién avisar`,
    text: msg`Cada fila es un hotel y una semana con hojas pendientes, con el Manager de Área responsable de ese departamento.`,
  },
] as const

/**
 * Semanas sin aprobar: lo que el Manager de Área no aprobó a tiempo. Lo que no
 * se aprueba no entra al Consolidado ni se paga, y esta pantalla dice a quién
 * le toca aprobarlo y cuántos días lleva esperando.
 */
export function PendingApprovalsPage(): ReactNode {
  const { t, i18n } = useLingui()
  const pending = useGetPendingApprovalsQuery()
  const timeliness = useGetApprovalTimelinessQuery()
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('semanas-sin-aprobar')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <Trans>Semanas sin aprobar</Trans>
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>
              Horas de semanas ya cerradas que el Manager de Área no ha aprobado. Lo que no se
              aprueba no entra al Consolidado ni se paga.
            </Trans>
            {IS_DEV_UI && <code className="ml-1.5 text-xs text-ink-4">operations.timesheet</code>}
          </p>
        </div>
        <button
          type="button"
          onClick={reopenIntro}
          className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-o-700 hover:bg-o-50"
        >
          <Trans>¿Cómo funciona?</Trans>
        </button>
      </header>

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funciona Semanas sin aprobar`}
        chromeless
      >
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Entendido`}
          onDone={dismissIntro}
        />
      </Modal>

      {pending.isError && (
        <LoadError
          message={t`No se pudieron cargar las semanas sin aprobar. Reintenta en unos segundos.`}
          onRetry={() => {
            void pending.refetch()
          }}
        />
      )}

      {pending.isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : (pending.data ?? []).length === 0 ? (
        <EmptyState
          title={t`Ninguna semana espera aprobación`}
          text={t`Cuando una semana cierre con horas sin aprobar, aparecerá aquí con el Manager de Área que debe aprobarla.`}
        />
      ) : (
        <div className="rounded-lg border border-line bg-surface">
          <Table className="min-w-[48rem] text-left">
            <TableHeader>
              <TableRow className="border-line">
                {[t`Hotel`, t`Semana`, t`Días de atraso`, t`Hojas pendientes`, t`Responsable`].map(
                  (header) => (
                    <TableHead key={header} className="text-xs font-semibold text-ink-3">
                      {header}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pending.data ?? []).map((row) => (
                <TableRow key={`${row.hotelId}-${row.weekStart}`} className="border-line">
                  <TableCell className="text-sm font-medium text-ink">{row.hotelName}</TableCell>
                  <TableCell className="text-sm text-ink-2">
                    {formatWeekRange(row.weekStart, row.weekEnd)}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-ink">{row.daysLate}</TableCell>
                  <TableCell className="text-sm text-ink-2">{row.pendingTimesheets}</TableCell>
                  <TableCell className="text-sm text-ink-2">
                    <ul className="space-y-0.5">
                      {row.responsables.map((r) => (
                        <li key={r.departmentName ?? 'sin-depto'}>
                          <span className="text-ink-3">{r.departmentName ?? '—'}: </span>
                          {r.managers.length === 0
                            ? t`Sin Manager de Área`
                            : r.managers.map((m) => m.fullName).join(', ')}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {timeliness.isError && (
        <LoadError
          message={t`No se pudo calcular la aprobación oportuna. Reintenta en unos segundos.`}
          onRetry={() => {
            void timeliness.refetch()
          }}
        />
      )}

      {timeliness.data && <ApprovalTimelinessPanel data={timeliness.data} />}
    </div>
  )
}

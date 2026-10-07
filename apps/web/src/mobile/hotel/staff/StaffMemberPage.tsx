import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useAppStaffBoardQuery,
  useAppStaffTransitionMutation,
  type StaffTransition,
} from './staffAppApi'
import { StaffAvatar, stateColor, stateLabel, TodayStatus } from './staffParts'

import { LoadError } from '@/shared/components/LoadError'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** Los motivos del catálogo, los mismos que ofrece el web (encargo 12). */
const REASONS: Record<StaffTransition, Array<{ code: string; label: MessageDescriptor }>> = {
  PINK: [
    { code: 'VACATION', label: msg`Vacaciones` },
    { code: 'LOW_SEASON', label: msg`Temporada baja` },
  ],
  RED: [
    { code: 'SERIOUS_MISCONDUCT', label: msg`Falta grave en el hotel` },
    { code: 'ABSENCES', label: msg`Inasistencias` },
  ],
}

function transitionError(error: unknown, toState: StaffTransition, i18n: I18n): string {
  return apiErrorMessage(error, {
    fallback:
      toState === 'PINK'
        ? i18n._(msg`No se pudo mandar a Stand-by. Inténtalo de nuevo.`)
        : i18n._(msg`No se pudo reportar al colaborador. Inténtalo de nuevo.`),
  })
}

/**
 * La ficha de un colaborador del hotel: su estado, su turno de hoy, cómo va
 * la semana y a quién llamar en una emergencia. Las acciones son las del web:
 *
 *   Stand-by (Rosa)  pausa, no baja: sigue siendo del hotel, sin turnos nuevos.
 *   Reportar (Rojo)  una incidencia: Inspección la revisa.
 *
 * Las dos con motivo obligatorio y nota opcional, y solo desde un estado
 * operativo (seed del semáforo) y con su permiso (`staff:set_standby`,
 * `staff:report`).
 */
export function StaffMemberPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { workerId = '' } = useParams()
  const can = useCan()
  const { data: board, isLoading, error, refetch } = useAppStaffBoardQuery()
  const [transition, { isLoading: isSending }] = useAppStaffTransitionMutation()
  const [action, setAction] = useState<StaffTransition | null>(null)
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const back = (
    <Link
      to="/hotel/staff"
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-o-700"
    >
      <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
      <Trans>Mi personal</Trans>
    </Link>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label={t`Cargando`}>
        {back}
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    )
  }

  const member = board?.members.find((item) => item.workerId === workerId)
  if (error || !member) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <LoadError
          message={
            error
              ? apiErrorMessage(error, { fallback: t`No se pudo cargar tu personal.` })
              : t`Este colaborador ya no está en tu personal.`
          }
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  const workerName = member.fullName
  const canStandBy = member.isOperational && can('staff:set_standby')
  const canReport = member.isOperational && can('staff:report')

  function open(next: StaffTransition): void {
    setAction(next)
    setReasonCode('')
    setNote('')
    setActionError(null)
  }

  async function submit(): Promise<void> {
    if (!action || reasonCode === '') return
    setActionError(null)
    try {
      await transition({
        workerId,
        toState: action,
        reasonCode,
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap()
      toast.success(
        action === 'PINK' ? t`${workerName} quedó en Stand-by` : t`${workerName} quedó reportado`,
      )
      setAction(null)
    } catch (cause) {
      setActionError(transitionError(cause, action, i18n))
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {back}

      <section className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-center">
        <StaffAvatar member={member} className="size-20 text-2xl" />
        <div>
          <h1 className="text-lg font-bold text-ink">{member.fullName}</h1>
          <p className="text-sm text-ink-3">{member.positionName ?? '—'}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-ink-2">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: stateColor(member.stateCode) }}
          />
          {stateLabel(member.stateCode)}
        </span>
        <TodayStatus member={member} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-3">
            <Trans>Asistencia</Trans>
          </p>
          <p className="text-xl font-semibold text-ink tabular-nums">
            {member.attendance === null ? '—' : `${String(member.attendance)}%`}
          </p>
          <p className="text-xs text-ink-3">
            <Trans>Esta semana</Trans>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-3">
            <Trans>Puntualidad</Trans>
          </p>
          <p className="text-xl font-semibold text-ink tabular-nums">
            {member.punctuality === null ? '—' : `${String(member.punctuality)}%`}
          </p>
          <p className="text-xs text-ink-3">
            <Trans>Hasta 10 min tarde</Trans>
          </p>
        </div>
      </section>

      <dl className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">
            <Trans>Teléfono</Trans>
          </dt>
          <dd className="text-right text-ink">
            <a href={`tel:${member.phone}`} className="font-medium text-o-700">
              {member.phone}
            </a>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">
            <Trans>Modalidad</Trans>
          </dt>
          <dd className="text-right text-ink">{member.hiringModality ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">
            <Trans>Inglés</Trans>
          </dt>
          <dd className="text-right text-ink">{member.englishLevel ?? '—'}</dd>
        </div>
        {member.emergencyContact && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">
              <Trans>Emergencia</Trans>
            </dt>
            <dd className="text-right text-ink">
              {member.emergencyContact.name} ({member.emergencyContact.relationship})
              <br />
              <a href={`tel:${member.emergencyContact.phone}`} className="font-medium text-o-700">
                {member.emergencyContact.phone}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {actionError && (
        <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
          {actionError}
        </p>
      )}

      {action ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">
            {action === 'PINK' ? t`Mandar a Stand-by a ${workerName}` : t`Reportar a ${workerName}`}
          </p>
          <p className="text-sm text-ink-2">
            {action === 'PINK'
              ? t`Pasa a Rosa: queda en pausa, sin turnos nuevos, hasta que el Hotel lo reactive.`
              : t`El colaborador pasa a Rojo: es una incidencia, no una pausa — Inspección la revisa y decide si vuelve o queda fuera.`}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
            <Trans>Motivo</Trans>
            <select
              value={reasonCode}
              onChange={(event) => {
                setReasonCode(event.target.value)
              }}
              className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink"
            >
              <option value="">{t`Elige el motivo…`}</option>
              {REASONS[action].map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {i18n._(reason.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
            <Trans>Nota (opcional)</Trans>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
              }}
              rows={3}
              className="rounded-xl border border-line bg-surface p-3 text-base font-normal text-ink"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={reasonCode === '' || isSending}
              onClick={() => {
                void submit()
              }}
              className={
                action === 'PINK'
                  ? 'min-h-12 flex-1 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink disabled:opacity-50'
                  : 'min-h-12 flex-1 rounded-xl bg-red px-4 text-sm font-semibold text-surface disabled:opacity-50'
              }
            >
              {isSending ? t`Mandando…` : action === 'PINK' ? t`Mandar a Stand-by` : t`Reportar`}
            </button>
            <button
              type="button"
              onClick={() => {
                setAction(null)
              }}
              className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-2"
            >
              <Trans>Cancelar</Trans>
            </button>
          </div>
        </section>
      ) : (
        (canStandBy || canReport) && (
          <div className="flex flex-col gap-2">
            {canStandBy && (
              <button
                type="button"
                onClick={() => {
                  open('PINK')
                }}
                className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink"
              >
                <Trans>Mandar a Stand-by</Trans>
              </button>
            )}
            {canReport && (
              <button
                type="button"
                onClick={() => {
                  open('RED')
                }}
                className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-red"
              >
                <Trans>Reportar</Trans>
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}

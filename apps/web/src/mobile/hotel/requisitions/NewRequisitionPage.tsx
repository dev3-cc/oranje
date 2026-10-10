import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import {
  useAppCreateRequisitionMutation,
  useAppPositionsForDepartmentQuery,
  useAppRequisitionCatalogsQuery,
} from './requisitionsAppApi'

import { useGetSessionQuery } from '@/app/sessionApi'
import { LoadError } from '@/shared/components/LoadError'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate, todayIn } from '@/shared/lib/formatters'

/**
 * Alta de una requisición desde la app, en tres pasos como el web
 * (`NewRequisitionDialog`): el hotel, las posiciones y la revisión. Mismo
 * contrato (`POST /requisitions`) y mismas reglas:
 *
 * - El hotel es el de la sesión: el hotel pide para sí mismo.
 * - El departamento se elige una vez y baja a todas las posiciones. El
 *   Supervisor y el Manager de Área lo traen fijo (su departamento, D-09); el
 *   Manager General lo elige.
 * - La requisición nace En elaboración: el folio lo pone el backend.
 *
 * Los mensajes de validación repiten los del web palabra por palabra para
 * reusar su traducción.
 */

interface PositionDraft {
  key: number
  catalogPositionId: string
  hiringModalityId: string
  englishLevelId: string
  quantity: string
  startDate: string
  startTime: string
}

type DraftErrors = Partial<Record<keyof Omit<PositionDraft, 'key'>, string>>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function emptyDraft(key: number): PositionDraft {
  return {
    key,
    catalogPositionId: '',
    hiringModalityId: '',
    englishLevelId: '',
    quantity: '1',
    startDate: '',
    startTime: '07:00',
  }
}

function validate(draft: PositionDraft, i18n: I18n): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.catalogPositionId) errors.catalogPositionId = i18n._(msg`Falta la posición`)
  if (!draft.hiringModalityId) errors.hiringModalityId = i18n._(msg`Falta la modalidad`)
  if (!/^\d+$/.test(draft.quantity) || Number(draft.quantity) < 1) {
    errors.quantity = i18n._(msg`Pide al menos 1 persona`)
  } else if (Number(draft.quantity) > 999) {
    errors.quantity = i18n._(msg`Máximo 999 personas por posición`)
  }
  if (!draft.startDate) errors.startDate = i18n._(msg`Falta la fecha de inicio`)
  else if (!DATE_PATTERN.test(draft.startDate)) {
    errors.startDate = i18n._(msg`La fecha debe ser un día real (AAAA-MM-DD)`)
  }
  if (!draft.startTime) errors.startTime = i18n._(msg`Falta la hora`)
  else if (!TIME_PATTERN.test(draft.startTime)) {
    errors.startTime = i18n._(msg`La hora debe ser HH:MM (00:00–23:59)`)
  }
  return errors
}

/** Mismos textos que el web (`NewRequisitionDialog`). */
function createErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      DEPARTMENT_OUT_OF_SCOPE: i18n._(
        msg`Solo puedes pedir posiciones de tu departamento. Las de otro departamento las crea su Manager de Área o el Manager General.`,
      ),
      HOTEL_OUT_OF_SCOPE: i18n._(msg`Solo puedes crear requisiciones de tu hotel.`),
      FORBIDDEN: i18n._(
        msg`Tu rol no puede crear requisiciones: las crean el Supervisor, el Manager de Área, el Manager General del hotel o el Inspector de su zona.`,
      ),
    },
    fallback: i18n._(
      msg`No se pudo guardar la requisición. Revisa las posiciones e inténtalo de nuevo.`,
    ),
  })
}

const FIELD = 'min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink'
const LABEL = 'flex flex-col gap-1.5 text-sm font-medium text-ink-2'

function FieldError({ message }: { message: string | undefined }): ReactNode {
  return message ? <span className="text-sm font-normal text-red">{message}</span> : null
}

export function NewRequisitionPage(): ReactNode {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const can = useCan()
  const { data: session } = useGetSessionQuery()
  const { data: catalogs, error: catalogsError, refetch } = useAppRequisitionCatalogsQuery()
  const [create, { isLoading: isCreating }] = useAppCreateRequisitionMutation()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [chosenDepartmentId, setChosenDepartmentId] = useState('')
  const [drafts, setDrafts] = useState<PositionDraft[]>([emptyDraft(1)])
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  /* El Supervisor y el Manager de Área piden para su departamento; el General elige. */
  const lockedDepartment = session?.department ?? null
  const departmentId = lockedDepartment?.id ?? chosenDepartmentId
  const { data: positions = [] } = useAppPositionsForDepartmentQuery(departmentId, {
    skip: departmentId === '',
  })

  if (session && !can('requisitions:create')) return <Navigate to="/hotel/requisitions" replace />

  const hotel = session?.hotel ?? null
  const departmentName =
    lockedDepartment?.name ??
    catalogs?.departments.find((item) => item.id === chosenDepartmentId)?.name ??
    ''
  const errorsByRow = drafts.map((draft) => validate(draft, i18n))
  const rowsValid = errorsByRow.every((errors) => Object.keys(errors).length === 0)

  function update(key: number, patch: Partial<PositionDraft>): void {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    )
  }

  function nameOf(list: Array<{ id: string; name: string }> | undefined, id: string): string {
    return list?.find((item) => item.id === id)?.name ?? '—'
  }

  async function onCreate(): Promise<void> {
    if (!hotel) return
    setSubmitError(null)
    try {
      const result = await create({
        hotelId: hotel.id,
        positions: drafts.map((draft) => ({
          catalogPositionId: draft.catalogPositionId,
          hiringModalityId: draft.hiringModalityId,
          hotelDepartmentId: departmentId,
          ...(draft.englishLevelId ? { englishLevelId: draft.englishLevelId } : {}),
          quantity: Number(draft.quantity),
          startDate: draft.startDate,
          startTime: draft.startTime,
        })),
      }).unwrap()
      toast.success(t`Requisición creada: queda En elaboración hasta que un Manager la autorice.`)
      await navigate(result.id ? `/hotel/requisitions/${result.id}` : '/hotel/requisitions', {
        replace: true,
      })
    } catch (cause) {
      setSubmitError(createErrorMessage(cause, i18n))
    }
  }

  const steps = [
    { step: 1, label: t`El hotel` },
    { step: 2, label: t`Las posiciones` },
    { step: 3, label: t`Revisión` },
  ] as const

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">
          <Trans>Nueva requisición</Trans>
        </h1>
        <Link
          to="/hotel/requisitions"
          className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink-3"
        >
          <Trans>Cancelar</Trans>
        </Link>
      </div>

      <ol className="flex gap-2" aria-label={t`Pasos`}>
        {steps.map((item) => (
          <li key={item.step} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn('h-1.5 rounded-full', step >= item.step ? 'bg-o-500' : 'bg-surface-3')}
            />
            <span
              aria-current={step === item.step ? 'step' : undefined}
              className={cn(
                'text-xs font-semibold',
                step === item.step ? 'text-ink' : 'text-ink-3',
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ol>

      {catalogsError ? (
        <LoadError
          message={apiErrorMessage(catalogsError, {
            fallback: t`No se pudieron cargar los catálogos.`,
          })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : step === 1 ? (
        <section className="flex flex-col gap-4">
          <div className={LABEL}>
            <Trans>Hotel</Trans>
            <p className="flex min-h-12 items-center rounded-xl bg-surface-2 px-3 text-base text-ink">
              {hotel?.name ?? '—'}
            </p>
          </div>
          {lockedDepartment ? (
            <div className={LABEL}>
              <Trans>Departamento</Trans>
              <p className="flex min-h-12 items-center rounded-xl bg-surface-2 px-3 text-base text-ink">
                {lockedDepartment.name}
              </p>
              <span className="text-xs font-normal text-ink-3">
                <Trans>Pides para tu departamento.</Trans>
              </span>
            </div>
          ) : (
            <label className={LABEL}>
              <Trans>Departamento</Trans>
              <select
                value={chosenDepartmentId}
                onChange={(event) => {
                  setChosenDepartmentId(event.target.value)
                  /* Los puestos dependen del departamento: se vuelven a elegir. */
                  setDrafts((current) =>
                    current.map((draft) => ({ ...draft, catalogPositionId: '' })),
                  )
                }}
                className={FIELD}
              >
                <option value="">{t`Elige el departamento`}</option>
                {catalogs?.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <FieldError
                message={
                  showErrors && !departmentId ? t`Falta el departamento del hotel` : undefined
                }
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => {
              if (!departmentId || !hotel) {
                setShowErrors(true)
                return
              }
              setShowErrors(false)
              setStep(2)
            }}
            className="min-h-12 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs active:bg-o-400"
          >
            <Trans>Continuar</Trans>
          </button>
        </section>
      ) : step === 2 ? (
        <section className="flex flex-col gap-4">
          <ul className="flex flex-col gap-4">
            {drafts.map((draft, index) => {
              const errors = showErrors ? (errorsByRow[index] ?? {}) : {}
              return (
                <li
                  key={draft.key}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">
                      <Trans>Posición {index + 1}</Trans>
                    </p>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        aria-label={t`Quitar la posición ${index + 1}`}
                        onClick={() => {
                          setDrafts((current) => current.filter((item) => item.key !== draft.key))
                        }}
                        className="flex size-11 items-center justify-center rounded-full text-ink-3 active:bg-surface-2"
                      >
                        <MaterialIcon name="delete" className="text-xl" aria-hidden />
                      </button>
                    )}
                  </div>
                  <label className={LABEL}>
                    <Trans>Posición</Trans>
                    <select
                      value={draft.catalogPositionId}
                      onChange={(event) => {
                        update(draft.key, { catalogPositionId: event.target.value })
                      }}
                      className={FIELD}
                    >
                      <option value="">{t`Elige la posición`}</option>
                      {positions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.catalogPositionId} />
                  </label>
                  <label className={LABEL}>
                    <Trans>Modalidad</Trans>
                    <select
                      value={draft.hiringModalityId}
                      onChange={(event) => {
                        update(draft.key, { hiringModalityId: event.target.value })
                      }}
                      className={FIELD}
                    >
                      <option value="">{t`Elige la modalidad`}</option>
                      {catalogs?.modalities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.hiringModalityId} />
                  </label>
                  <label className={LABEL}>
                    <Trans>Inglés</Trans>
                    <select
                      value={draft.englishLevelId}
                      onChange={(event) => {
                        update(draft.key, { englishLevelId: event.target.value })
                      }}
                      className={FIELD}
                    >
                      <option value="">{t`No requerido`}</option>
                      {catalogs?.englishLevels.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={LABEL}>
                      <Trans>Cantidad</Trans>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={999}
                        value={draft.quantity}
                        onChange={(event) => {
                          update(draft.key, { quantity: event.target.value })
                        }}
                        className={FIELD}
                      />
                      <FieldError message={errors.quantity} />
                    </label>
                    <label className={LABEL}>
                      <Trans>Hora</Trans>
                      <input
                        type="time"
                        value={draft.startTime}
                        onChange={(event) => {
                          update(draft.key, { startTime: event.target.value.slice(0, 5) })
                        }}
                        className={FIELD}
                      />
                      <FieldError message={errors.startTime} />
                    </label>
                  </div>
                  <label className={LABEL}>
                    <Trans>Fecha de inicio</Trans>
                    <input
                      type="date"
                      min={todayIn(hotel?.timeZone)}
                      value={draft.startDate}
                      onChange={(event) => {
                        update(draft.key, { startDate: event.target.value })
                      }}
                      className={FIELD}
                    />
                    <FieldError message={errors.startDate} />
                  </label>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setDrafts((current) => [
                ...current,
                emptyDraft(Math.max(...current.map((draft) => draft.key)) + 1),
              ])
            }}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-dashed border-o-500/60 bg-o-50 px-4 text-sm font-semibold text-o-700"
          >
            <MaterialIcon name="add" className="text-lg" aria-hidden />
            <Trans>Agregar posición</Trans>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep(1)
              }}
              className="min-h-12 rounded-xl border border-line px-4 text-sm font-semibold text-ink-2"
            >
              <Trans>Atrás</Trans>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!rowsValid) {
                  setShowErrors(true)
                  return
                }
                setShowErrors(false)
                setStep(3)
              }}
              className="min-h-12 flex-1 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs active:bg-o-400"
            >
              <Trans>Continuar</Trans>
            </button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">
                <Trans>Hotel</Trans>
              </dt>
              <dd className="text-right font-medium text-ink">{hotel?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">
                <Trans>Departamento</Trans>
              </dt>
              <dd className="text-right font-medium text-ink">{departmentName}</dd>
            </div>
          </dl>
          <ul className="flex flex-col gap-3">
            {drafts.map((draft, index) => (
              <li key={draft.key} className="rounded-2xl border border-line bg-surface p-4 text-sm">
                <p className="font-semibold text-ink">
                  {index + 1}. {nameOf(positions, draft.catalogPositionId)} × {draft.quantity}
                </p>
                <p className="mt-1 text-ink-2">
                  {nameOf(catalogs?.modalities, draft.hiringModalityId)} ·{' '}
                  {draft.englishLevelId
                    ? nameOf(catalogs?.englishLevels, draft.englishLevelId)
                    : t`No requerido`}
                </p>
                <p className="text-ink-2">
                  {formatDate(draft.startDate)} · {draft.startTime}
                </p>
              </li>
            ))}
          </ul>
          <p className="rounded-xl bg-o-50 p-3 text-sm text-o-900">
            <Trans>
              Nace En elaboración: el folio se asigna al guardar y Reclutamiento la ve cuando un
              Manager la autoriza.
            </Trans>
          </p>
          {submitError && (
            <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
              {submitError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep(2)
              }}
              className="min-h-12 rounded-xl border border-line px-4 text-sm font-semibold text-ink-2"
            >
              <Trans>Atrás</Trans>
            </button>
            <button
              type="button"
              disabled={isCreating}
              onClick={() => {
                void onCreate()
              }}
              className="min-h-12 flex-1 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs active:bg-o-400 disabled:opacity-60"
            >
              {isCreating ? t`Guardando…` : t`Crear requisición`}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  type StatusLightToken,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useCreatePayAdjustmentMutation, useGetPayConceptsQuery } from '../api/payAdjustmentsApi'
import {
  useCreateAssignmentMutation,
  AL_ATERRIZAR,
  useGetAssignableWorkersQuery,
  useGetSlotBoardQuery,
  useReleaseAssignmentMutation,
} from '../api/selfPickApi'
import { ASSIGNMENT_TYPE_LABEL } from '../types/selfPick.types'

import mascotaCelebrando from '@/assets/mascota/mascota-celebrando.png'
import { useGetPositionPayRateQuery } from '@/features/contracts'
import { useJoinRequisitionMutation } from '@/features/requisitions'
import { Button } from '@/shared/components/Button'
import { DateField } from '@/shared/components/DateField'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_TOKEN,
  type RequisitionStatus,
} from '@/shared/constants/requisitionStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage, readApiError } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatMoney } from '@/shared/lib/formatters'

const COVERAGE_TOKEN: Record<string, StatusLightToken> = {
  RED: 'st-rojo',
  YELLOW: 'st-amarillo',
  LIGHT_BLUE: 'st-azul-claro',
  GREEN: 'st-verde',
}

/** El `i18n` viene del componente (D-36). */
function assignErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      /* El 409 de esta acción tiene dos causas reales, y las dos son honestas
         de por sí — nunca es la carrera de RR-15, esa la resuelve `freeSlot`
         antes de intentar el insert. Antes las dos caían en el mismo texto,
         que solo es cierto para ninguna. */
      WORKER_ALREADY_ASSIGNED: (info) =>
        info.message ?? i18n._(msg`Ese colaborador ya tiene una asignación activa.`),
      REQUISITION_NOT_IN_PROGRESS: i18n._(
        msg`Esta requisición ya no está en proceso: revisa su estado antes de asignar.`,
      ),
    },
    byStatus: {
      409: i18n._(
        msg`Otra Reclutadora tomó este slot antes${IS_DEV_UI ? ' (RR-15)' : ''}: el tablero ya se actualizó, revisa el siguiente libre.`,
      ),
    },
    fallback: i18n._(msg`No se pudo asignar al colaborador. Inténtalo de nuevo.`),
  })
}

/**
 * Mismo texto que ya usa `RequisitionDetailPage` para «Unirse» — aquí se
 * dispara sola, no por un botón, cuando la requisición sigue en GREEN.
 */
function joinErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      REQUISITION_NOT_OPEN: i18n._(
        msg`Esta requisición ya no está autorizada o en proceso: no se puede unir.`,
      ),
    },
    fallback: i18n._(msg`No se pudo tomar la requisición. Inténtalo de nuevo.`),
  })
}

/** El `i18n` viene del componente (D-36). */
function releaseErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      REQUISITION_CLOSED: i18n._(msg`Esta requisición ya cerró: el slot no vuelve a abrirse.`),
    },
    fallback: i18n._(msg`No se pudo liberar el slot. Inténtalo de nuevo.`),
  })
}

/** El `i18n` viene del componente (D-36). */
function adjustmentErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    fallback: i18n._(
      msg`La asignación quedó hecha, pero el ajuste/gasto no se pudo pedir. Vuelve a intentarlo.`,
    ),
  })
}

export function SlotAssignmentPage(): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const { requisitionId = '', positionId = '' } = useParams()

  const {
    data: board,
    isLoading,
    isError,
  } = useGetSlotBoardQuery(
    { requisitionId, positionId },
    { skip: requisitionId === '' || positionId === '', ...AL_ATERRIZAR },
  )
  const { data: workers = [] } = useGetAssignableWorkersQuery(undefined, AL_ATERRIZAR)
  /* Solo el pago (Hugo, 2026-09-22): nunca la factura al hotel, que es de
     Ventas. `null` es honesto — sin contrato activo o sin esa posición
     cotizada — y no bloquea la asignación. */
  const { data: positionPayRate } = useGetPositionPayRateQuery(
    { hotelId: board?.hotelId ?? '', catalogPositionId: board?.catalogPositionId ?? '' },
    { skip: !board },
  )
  const [assign, { isLoading: isSaving, isError: hasFailed, error: saveError }] =
    useCreateAssignmentMutation()
  const [release, { isLoading: isReleasing, error: releaseError }] = useReleaseAssignmentMutation()
  const [join, { isLoading: isJoining }] = useJoinRequisitionMutation()

  const [workerId, setWorkerId] = useState('')
  const [type, setType] = useState<'FIXED' | 'TEMPORARY'>('FIXED')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  /** Error de la toma silenciosa (ver `submit`); `null` = no aplica o ya pasó. */
  const [joinError, setJoinError] = useState<unknown>(null)

  /* El ajuste de tarifa Y el gasto extra (Uber…) de una EVENTUAL (Hugo,
     2026-10-08): opcional, solo con `type === 'TEMPORARY'`, y solo si el rol
     puede pedirlo — lo aprueba el Observador, nunca quien lo pide. Son dos
     cosas INDEPENDIENTES, no una u otra (Hugo, 2026-10-08): una misma
     asignación puede llevar las dos, cada una su propia aprobación — por eso
     el back no tiene UNIQUE sobre `assignmentId`. */
  const canRequestAdjustment = can('requisitions:request_pay_adjustment')
  const [createAdjustment, { isLoading: isSavingAdjustment }] = useCreatePayAdjustmentMutation()
  const { data: payConcepts = [] } = useGetPayConceptsQuery(undefined, {
    skip: !canRequestAdjustment || type !== 'TEMPORARY',
  })

  const [wantsRateAdjustment, setWantsRateAdjustment] = useState(false)
  const [rateAmount, setRateAmount] = useState('')
  const [rateReason, setRateReason] = useState('')
  const [rateError, setRateError] = useState<unknown>(null)
  const [rateRequested, setRateRequested] = useState<string | null>(null)

  const [wantsExpense, setWantsExpense] = useState(false)
  const [expensePayConceptId, setExpensePayConceptId] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseReason, setExpenseReason] = useState('')
  const [expenseError, setExpenseError] = useState<unknown>(null)
  const [expenseRequested, setExpenseRequested] = useState<string | null>(null)

  /* Fija deja de tener sentido pedir un ajuste eventual: se limpian los dos
     paneles para no pedirlo por error junto a una asignación FIJA. */
  useEffect(() => {
    if (type !== 'TEMPORARY') {
      setWantsRateAdjustment(false)
      setWantsExpense(false)
      setRateError(null)
      setExpenseError(null)
    }
  }, [type])

  /* La posición ya dice desde cuándo la pidió el hotel: se propone esa fecha y
     se puede cambiar. Antes arrancaba vacía y se tecleaba a mano, con el riesgo
     de asignar desde un día distinto al solicitado. */
  useEffect(() => {
    if (board?.startDate) setStartDate((current) => current || board.startDate)
  }, [board?.startDate])

  /** El slot cuya liberación se está confirmando (con motivo); `null` = ninguno. */
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null)
  const [releaseReason, setReleaseReason] = useState('')

  async function confirmRelease(): Promise<void> {
    if (releaseTarget === null || releaseReason.trim() === '') return
    try {
      await release({
        assignmentId: releaseTarget,
        positionId,
        reason: releaseReason.trim(),
      }).unwrap()
      toast.success(t`Slot liberado`)
      setReleaseTarget(null)
      setReleaseReason('')
    } catch {
      return
    }
  }

  if (isLoading) return <DetailSkeleton />
  if (isError || !board) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">
          <Trans>No se encontró esta posición: puede que ya se haya cubierto o eliminado.</Trans>
        </p>
        <Link to="/self-pick" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver a la Bolsa</Trans>
        </Link>
      </div>
    )
  }

  const rateAmountValue = Number(rateAmount)
  const isRateFilled =
    !wantsRateAdjustment || (rateAmount !== '' && rateAmountValue > 0 && rateReason.trim() !== '')

  const expenseAmountValue = Number(expenseAmount)
  const isExpenseFilled =
    !wantsExpense ||
    (expenseAmount !== '' &&
      expenseAmountValue > 0 &&
      expenseReason.trim() !== '' &&
      expensePayConceptId !== '')

  const canSubmit =
    board.nextFreeOrdinal !== null &&
    workerId !== '' &&
    (type !== 'TEMPORARY' || endDate !== '') &&
    isRateFilled &&
    isExpenseFilled &&
    !isSaving &&
    !isJoining &&
    !isSavingAdjustment

  async function submit(): Promise<void> {
    if (!canSubmit) return
    setJoinError(null)
    setRateError(null)
    setExpenseError(null)
    setRateRequested(null)
    setExpenseRequested(null)
    const assignedName = workers.find((worker) => worker.id === workerId)?.fullName
    try {
      /*
       * El Self-Pick es el modelo colaborativo (RR-15): asignar el primer
       * slot ES tomar la requisición, sin pasar antes por «Unirse» en la
       * ficha — esa pantalla vive aparte y el tablero de Self-Pick nunca
       * enlaza a ella. Sin esto, toda requisición recién autorizada (GREEN,
       * nadie la tomó todavía) rechazaba CUALQUIER asignación con
       * REQUISITION_NOT_IN_PROGRESS: la Reclutadora no tenía forma de
       * resolverlo desde aquí (2026-09-28).
       */
      if (board?.requisitionState.code === 'GREEN') {
        try {
          await join(requisitionId).unwrap()
        } catch (error) {
          const info = readApiError(error)
          /* `message` cubre el mock local, que no anida bajo `.error.code`
             (ver apiError.ts); el back real sí manda `code`. */
          if (info.code !== 'ALREADY_PARTICIPATING' && info.message !== 'ALREADY_PARTICIPATING') {
            setJoinError(error)
            return
          }
        }
      }
      const created = await assign({
        positionId,
        workerId,
        type,
        ...(startDate !== '' ? { startDate } : {}),
        ...(endDate !== '' ? { endDate } : {}),
      }).unwrap()
      toast.success(
        assignedName === undefined
          ? t`Colaborador asignado al slot`
          : t`${assignedName} asignado al slot`,
      )
      setWorkerId('')
      setStartDate('')
      setEndDate('')

      /* El ajuste y el gasto se piden DESPUÉS, cada uno por su cuenta: no
         existen hasta que la asignación existe, y son dos cosas
         independientes — pueden ir las dos juntas (Hugo, 2026-10-08). Si uno
         falla, el otro se intenta igual; la asignación YA quedó hecha, el
         error de cada uno se muestra aparte. */
      if (wantsRateAdjustment) {
        try {
          await createAdjustment({
            assignmentId: created.assignment.id,
            amount: rateAmountValue,
            reason: rateReason.trim(),
          }).unwrap()
          toast.success(t`Ajuste de tarifa pedido: queda pendiente de que lo apruebe el Observador`)
          setRateRequested(rateAmountValue.toFixed(2))
          setWantsRateAdjustment(false)
          setRateAmount('')
          setRateReason('')
        } catch (error) {
          setRateError(error)
        }
      }

      if (wantsExpense) {
        try {
          await createAdjustment({
            assignmentId: created.assignment.id,
            payConceptId: expensePayConceptId,
            amount: expenseAmountValue,
            reason: expenseReason.trim(),
          }).unwrap()
          toast.success(t`Gasto pedido: queda pendiente de que lo apruebe el Observador`)
          setExpenseRequested(expenseAmountValue.toFixed(2))
          setWantsExpense(false)
          setExpenseAmount('')
          setExpenseReason('')
          setExpensePayConceptId('')
        } catch (error) {
          setExpenseError(error)
        }
      }
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/self-pick" className="hover:text-o-700">
          <Trans>Bolsa · Self-Pick</Trans>
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">{board.requisitionNumber}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-ink">
          <Trans>Asignación de slot</Trans>
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          <Trans>
            {board.requisitionNumber} · {board.hotelName} · renglón {board.lineNumber} ·{' '}
            {board.positionName}
          </Trans>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <StatusLightSoftBadge
            token={
              REQUISITION_STATUS_TOKEN[board.requisitionState.code as RequisitionStatus] ??
              'st-gris'
            }
            label={
              IS_DEV_UI
                ? `Requisición · ${board.requisitionState.code} · ${board.requisitionState.name}`
                : t`Requisición · ${board.requisitionState.name}`
            }
          />
          <StatusLightSoftBadge
            token={COVERAGE_TOKEN[board.coverage.code] ?? 'st-gris'}
            label={
              IS_DEV_UI
                ? `Cobertura · ${board.coverage.code} · ${board.coverage.name}`
                : t`Cobertura · ${board.coverage.name}`
            }
          />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <SectionCard
          title={t`Slots del renglón`}
          subtitle={
            IS_DEV_UI
              ? 'demand.slot · uno por unidad de quantity'
              : t`Un slot por cada persona pedida en la posición`
          }
        >
          <ul className="divide-y divide-line">
            {board.slots.map((slot) => (
              <li key={slot.ordinal} className="py-3">
                {/* `flex-wrap`: con nombre largo + tipo + estado + Liberar no
                    caben en una sola línea en mobile — antes se salían del
                    borde en vez de bajar de renglón (Hugo, 2026-10-08). */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      slot.workerName === null ? 'bg-o-50 text-o-700' : 'bg-surface-2 text-ink-3',
                    )}
                  >
                    {slot.ordinal}
                  </span>
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="truncate text-sm font-medium text-ink">
                      {slot.workerName ?? '—'}
                    </p>
                    {IS_DEV_UI && (
                      <code className="text-[11px] text-ink-4">ordinal {slot.ordinal}</code>
                    )}
                  </div>
                  <div className="ml-[44px] flex flex-wrap items-center gap-2 sm:ml-0">
                    {slot.assignmentType !== null && (
                      <span className="text-xs text-ink-3">
                        {ASSIGNMENT_TYPE_LABEL[slot.assignmentType] ?? slot.assignmentType}
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium',
                        slot.workerName === null
                          ? 'border border-dashed border-o-500 text-o-700'
                          : 'bg-surface-2 text-ink-2',
                      )}
                    >
                      {slot.workerName === null ? t`libre` : t`ocupado`}
                    </span>
                    {/* Antes de esto no había forma de deshacer una asignación
                        mal hecha desde la pantalla: solo por API. */}
                    {slot.assignmentId !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setReleaseTarget(
                            releaseTarget === slot.assignmentId ? null : slot.assignmentId,
                          )
                          setReleaseReason('')
                        }}
                        className="shrink-0 cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                      >
                        <Trans>Liberar</Trans>
                      </button>
                    )}
                  </div>
                </div>

                {releaseTarget !== null && releaseTarget === slot.assignmentId && (
                  <div className="mt-2.5 ml-[52px] flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-ink-3">
                        <Trans>Motivo (queda en el journal, obligatorio)</Trans>
                      </span>
                      <Input
                        value={releaseReason}
                        onChange={(event) => {
                          setReleaseReason(event.target.value)
                        }}
                        placeholder={t`Por qué se libera este slot…`}
                        aria-label={t`Motivo para liberar el slot`}
                      />
                    </label>
                    {releaseError !== undefined && (
                      <p role="alert" className="text-xs text-red">
                        {releaseErrorMessage(releaseError, i18n)}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => {
                          setReleaseTarget(null)
                        }}
                      >
                        <Trans>Cancelar</Trans>
                      </Button>
                      <Button
                        variant="primary"
                        disabled={releaseReason.trim() === '' || isReleasing}
                        onClick={() => {
                          void confirmRelease()
                        }}
                      >
                        {isReleasing ? <Trans>Liberando…</Trans> : <Trans>Sí, liberar slot</Trans>}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title={
            board.nextFreeOrdinal === null
              ? t`Renglón completo`
              : t`Asignar al slot ${String(board.nextFreeOrdinal)}`
          }
          subtitle={
            IS_DEV_UI ? 'coverage.assignment' : t`Elige quién ocupa el siguiente slot libre`
          }
          /* El panel de asignar se queda a la vista mientras la lista de slots baja. */
          className="self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto"
        >
          {board.nextFreeOrdinal === null ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <img src={mascotaCelebrando} alt="" aria-hidden className="h-32 w-auto" />
              <p className="text-sm leading-relaxed text-ink-2">
                <Trans>
                  Los {board.slots.length} slots están ocupados: la cobertura del renglón quedó
                  completa.
                </Trans>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {positionPayRate && (
                <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
                  <p className="text-xs text-ink-3">
                    <Trans>Se le paga a esta posición</Trans>
                  </p>
                  <p className="text-lg font-bold text-ink">
                    {formatMoney(positionPayRate.payRate)}
                    <span className="text-sm font-normal text-ink-3"> / hora</span>
                  </p>
                  {IS_DEV_UI && (
                    <code className="text-[11px] text-ink-4">
                      contrato {positionPayRate.contractNumber}
                    </code>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="assignment-worker" className="text-sm text-ink-3">
                  <Trans>Colaborador</Trans>
                  {IS_DEV_UI && (
                    <code className="text-xs text-ink-4"> · worker_id → personal.worker</code>
                  )}
                </label>
                <Select {...(workerId ? { value: workerId } : {})} onValueChange={setWorkerId}>
                  <SelectTrigger
                    id="assignment-worker"
                    aria-label={t`Colaborador`}
                    className="w-full"
                  >
                    <SelectValue placeholder={t`Elige a un colaborador Disponible…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.fullName} · {worker.zoneName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Sin esto, una lista corta se lee como que el Pool está vacío
                    o el sistema está roto — y casi siempre es que a alguien le
                    falta su expediente o ya está en otra asignación. */}
                <p className="text-xs text-ink-3">
                  <Trans>
                    Solo aparece quien está en Verde fuerte: expediente completo, validado por
                    Reclutamiento y sin otra asignación activa.
                  </Trans>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="assignment-type" className="text-sm text-ink-3">
                  <Trans>Tipo</Trans>
                  {IS_DEV_UI && <code className="text-xs text-ink-4"> · type</code>}
                </label>
                <Select
                  value={type}
                  onValueChange={(value) => {
                    setType(value as 'FIXED' | 'TEMPORARY')
                  }}
                >
                  <SelectTrigger id="assignment-type" aria-label={t`Tipo`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">
                      <Trans>Fijo</Trans>
                    </SelectItem>
                    <SelectItem value="TEMPORARY">
                      <Trans>Temporal</Trans>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-3">
                    <Trans>Inicio</Trans>
                  </span>
                  <DateField
                    value={startDate}
                    onChange={setStartDate}
                    aria-label={t`Fecha de inicio`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-3">
                    {type === 'TEMPORARY' ? <Trans>Fin</Trans> : <Trans>Fin (opcional)</Trans>}
                  </span>
                  <DateField
                    value={endDate}
                    onChange={setEndDate}
                    min={startDate}
                    aria-label={t`Fecha de fin`}
                  />
                </div>
              </div>
              {IS_DEV_UI && (
                <code className="-mt-2 text-[11px] text-ink-4">
                  validity · daterange, no dos fechas sueltas
                </code>
              )}
              {type === 'TEMPORARY' && (
                <p className="text-xs text-ink-3">
                  <Trans>
                    Una asignación temporal necesita fecha de fin: mientras dure, el colaborador
                    está en Café y al vencer vuelve a su estado anterior.
                  </Trans>
                </p>
              )}

              {type === 'TEMPORARY' && canRequestAdjustment && (
                <div className="flex flex-col gap-3 rounded-md border border-dashed border-line p-3">
                  <p className="text-xs text-ink-3">
                    <Trans>
                      Opcional, y las dos pueden ir juntas: cada una la aprueba el Observador por
                      separado antes de que pese en el pago.
                    </Trans>
                  </p>

                  {/* ——— Ajuste a la tarifa de esta posición ——— */}
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={wantsRateAdjustment}
                      onChange={(event) => {
                        setWantsRateAdjustment(event.target.checked)
                        setRateError(null)
                      }}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-ink-2">
                      <Trans>Ajustar la tarifa de esta posición</Trans>
                    </span>
                  </label>
                  {wantsRateAdjustment && (
                    <div className="flex flex-col gap-3 pl-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-ink-3">
                          <Trans>Tarifa acordada</Trans>
                        </span>
                        <div className="relative">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-3"
                          >
                            $
                          </span>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={rateAmount}
                            onChange={(event) => {
                              setRateAmount(event.target.value)
                            }}
                            placeholder="0.00"
                            aria-label={t`Tarifa acordada, en dólares`}
                            className="pl-6"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-ink-3">
                          <Trans>Motivo</Trans>
                        </span>
                        <Input
                          value={rateReason}
                          onChange={(event) => {
                            setRateReason(event.target.value)
                          }}
                          placeholder={t`Por qué esta tarifa…`}
                          aria-label={t`Motivo del ajuste de tarifa`}
                        />
                      </div>
                    </div>
                  )}
                  {rateError !== null && (
                    <p role="alert" className="text-xs text-red">
                      {adjustmentErrorMessage(rateError, i18n)}
                    </p>
                  )}
                  {rateRequested !== null && (
                    <p className="rounded-md bg-o-50 px-3 py-2 text-xs text-o-700">
                      <Trans>
                        Ajuste de {formatMoney(Number(rateRequested))} pedido: pendiente de
                        aprobación.
                      </Trans>
                    </p>
                  )}

                  <hr className="border-line" />

                  {/* ——— Gasto extra (Uber…) ——— */}
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={wantsExpense}
                      onChange={(event) => {
                        setWantsExpense(event.target.checked)
                        setExpenseError(null)
                      }}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-ink-2">
                      <Trans>Agregar un gasto extra (p. ej. Uber)</Trans>
                    </span>
                  </label>
                  {wantsExpense && (
                    <div className="flex flex-col gap-3 pl-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-ink-3">
                          <Trans>Concepto</Trans>
                        </span>
                        <Select
                          {...(expensePayConceptId ? { value: expensePayConceptId } : {})}
                          onValueChange={setExpensePayConceptId}
                        >
                          <SelectTrigger aria-label={t`Concepto del gasto`} className="w-full">
                            <SelectValue placeholder={t`Elige el concepto…`} />
                          </SelectTrigger>
                          <SelectContent>
                            {payConcepts.map((concept) => (
                              <SelectItem key={concept.id} value={concept.id}>
                                {concept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {payConcepts.length === 0 && (
                          <p className="text-xs text-ink-3">
                            <Trans>
                              Sin conceptos en el catálogo: pídele al Administrador que agregue uno
                              en Catálogos.
                            </Trans>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-ink-3">
                          <Trans>Monto</Trans>
                        </span>
                        <div className="relative">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-3"
                          >
                            $
                          </span>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={expenseAmount}
                            onChange={(event) => {
                              setExpenseAmount(event.target.value)
                            }}
                            placeholder="0.00"
                            aria-label={t`Monto del gasto, en dólares`}
                            className="pl-6"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm text-ink-3">
                          <Trans>Motivo</Trans>
                        </span>
                        <Input
                          value={expenseReason}
                          onChange={(event) => {
                            setExpenseReason(event.target.value)
                          }}
                          placeholder={t`Por qué este gasto…`}
                          aria-label={t`Motivo del gasto`}
                        />
                      </div>
                    </div>
                  )}
                  {expenseError !== null && (
                    <p role="alert" className="text-xs text-red">
                      {adjustmentErrorMessage(expenseError, i18n)}
                    </p>
                  )}
                  {expenseRequested !== null && (
                    <p className="rounded-md bg-o-50 px-3 py-2 text-xs text-o-700">
                      <Trans>
                        Gasto de {formatMoney(Number(expenseRequested))} pedido: pendiente de
                        aprobación.
                      </Trans>
                    </p>
                  )}
                </div>
              )}

              {workerId === '' ? (
                <p className="text-xs text-ink-3">
                  <Trans>Elige a un colaborador para asignar</Trans>
                </p>
              ) : type === 'TEMPORARY' && endDate === '' ? (
                <p className="text-xs text-ink-3">
                  <Trans>Una asignación temporal necesita fecha de fin</Trans>
                </p>
              ) : null}
              <Button
                variant="primary"
                disabled={!canSubmit}
                onClick={() => {
                  void submit()
                }}
              >
                {isJoining || isSaving || isSavingAdjustment ? (
                  <Trans>Asignando…</Trans>
                ) : (
                  <Trans>Asignar colaborador</Trans>
                )}
              </Button>

              {joinError !== null ? (
                <p role="alert" className="text-sm text-red">
                  {joinErrorMessage(joinError, i18n)}
                </p>
              ) : (
                hasFailed && (
                  <p role="alert" className="text-sm text-red">
                    {assignErrorMessage(saveError, i18n)}
                  </p>
                )
              )}

              <p className="text-xs leading-relaxed text-ink-4">
                {IS_DEV_UI ? (
                  <>
                    Gana el primero, y lo hace cumplir el motor: RR-15 se resuelve con{' '}
                    <code>SKIP LOCKED</code> sobre la fila del slot (D-02) — dos reclutadoras
                    simultáneas y solo una gana; la otra recibe 409.
                  </>
                ) : (
                  <Trans>
                    Gana la primera que confirma: si alguien se adelanta, el tablero se actualiza al
                    momento.
                  </Trans>
                )}
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

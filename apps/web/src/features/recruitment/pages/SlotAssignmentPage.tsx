import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type StatusLightToken,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useCreateAssignmentMutation,
  useGetAssignableWorkersQuery,
  useGetSlotBoardQuery,
} from '../api/selfPickApi'
import { ASSIGNMENT_TYPE_LABEL } from '../types/selfPick.types'

import mascotaCelebrando from '@/assets/mascota/mascota-celebrando.png'
import { Button } from '@/shared/components/Button'
import { LoadingState } from '@/shared/components/LoadingState'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_TOKEN,
  type RequisitionStatus,
} from '@/shared/constants/requisitionStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const COVERAGE_TOKEN: Record<string, StatusLightToken> = {
  RED: 'st-rojo',
  YELLOW: 'st-amarillo',
  LIGHT_BLUE: 'st-azul-claro',
  GREEN: 'st-verde',
}

function assignErrorMessage(error: unknown): string {
  return apiErrorMessage(error, {
    byStatus: {
      409: `Otra Reclutadora tomó este slot antes${IS_DEV_UI ? ' (RR-15)' : ''}: el tablero ya se actualizó, revisa el siguiente libre.`,
    },
    fallback: 'No se pudo asignar al colaborador. Inténtalo de nuevo.',
  })
}

export function SlotAssignmentPage(): ReactNode {
  const { requisitionId = '', positionId = '' } = useParams()

  const {
    data: board,
    isLoading,
    isError,
  } = useGetSlotBoardQuery(
    { requisitionId, positionId },
    { skip: requisitionId === '' || positionId === '' },
  )
  const { data: workers = [] } = useGetAssignableWorkersQuery()
  const [assign, { isLoading: isSaving, isError: hasFailed, error: saveError }] =
    useCreateAssignmentMutation()

  const [workerId, setWorkerId] = useState('')
  const [type, setType] = useState<'FIXED' | 'TEMPORARY'>('FIXED')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  if (isLoading) return <LoadingState label="Cargando los slots…" />
  if (isError || !board) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">
          No se encontró esta posición: puede que ya se haya cubierto o eliminado.
        </p>
        <Link to="/self-pick" className="text-sm font-semibold text-o-700 hover:underline">
          Volver a la Bolsa
        </Link>
      </div>
    )
  }

  const canSubmit =
    board.nextFreeOrdinal !== null &&
    workerId !== '' &&
    (type !== 'TEMPORARY' || endDate !== '') &&
    !isSaving

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await assign({
        positionId,
        workerId,
        type,
        ...(startDate !== '' ? { startDate } : {}),
        ...(endDate !== '' ? { endDate } : {}),
      }).unwrap()
      setWorkerId('')
      setStartDate('')
      setEndDate('')
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/self-pick" className="hover:text-o-700">
          Bolsa · Self-Pick
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">{board.requisitionNumber}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-ink">Asignación de slot</h1>
        <p className="mt-1 text-sm text-ink-3">
          {board.requisitionNumber} · {board.hotelName} · renglón {board.lineNumber} ·{' '}
          {board.positionName}
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
                : `Requisición · ${board.requisitionState.name}`
            }
          />
          <StatusLightSoftBadge
            token={COVERAGE_TOKEN[board.coverage.code] ?? 'st-gris'}
            label={
              IS_DEV_UI
                ? `Cobertura · ${board.coverage.code} · ${board.coverage.name}`
                : `Cobertura · ${board.coverage.name}`
            }
          />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <SectionCard
          title="Slots del renglón"
          subtitle={
            IS_DEV_UI
              ? 'demand.slot · uno por unidad de quantity'
              : 'Un slot por cada persona pedida en la posición'
          }
        >
          <ul className="divide-y divide-line">
            {board.slots.map((slot) => (
              <li key={slot.ordinal} className="flex items-center gap-4 py-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    slot.workerName === null ? 'bg-o-50 text-o-700' : 'bg-surface-2 text-ink-3',
                  )}
                >
                  {slot.ordinal}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{slot.workerName ?? '—'}</p>
                  {IS_DEV_UI && (
                    <code className="text-[11px] text-ink-4">ordinal {slot.ordinal}</code>
                  )}
                </div>
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
                  {slot.workerName === null ? 'libre' : 'ocupado'}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title={
            board.nextFreeOrdinal === null
              ? 'Renglón completo'
              : `Asignar al slot ${String(board.nextFreeOrdinal)}`
          }
          subtitle={IS_DEV_UI ? 'coverage.assignment' : 'Elige quién ocupa el siguiente slot libre'}
          className="self-start"
        >
          {board.nextFreeOrdinal === null ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <img src={mascotaCelebrando} alt="" aria-hidden className="h-32 w-auto" />
              <p className="text-sm leading-relaxed text-ink-2">
                Los {board.slots.length} slots están ocupados: la cobertura del renglón quedó
                completa.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="assignment-worker" className="text-sm text-ink-3">
                  Colaborador
                  {IS_DEV_UI && (
                    <code className="text-xs text-ink-4"> · worker_id → personal.worker</code>
                  )}
                </label>
                <Select {...(workerId ? { value: workerId } : {})} onValueChange={setWorkerId}>
                  <SelectTrigger id="assignment-worker" aria-label="Colaborador" className="w-full">
                    <SelectValue placeholder="Elige a un colaborador Disponible…" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.fullName} · {worker.zoneName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="assignment-type" className="text-sm text-ink-3">
                  Tipo{IS_DEV_UI && <code className="text-xs text-ink-4"> · type</code>}
                </label>
                <Select
                  value={type}
                  onValueChange={(value) => {
                    setType(value as 'FIXED' | 'TEMPORARY')
                  }}
                >
                  <SelectTrigger id="assignment-type" aria-label="Tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fijo</SelectItem>
                    <SelectItem value="TEMPORARY">Temporal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-3">Inicio</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value)
                    }}
                    aria-label="Fecha de inicio"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-3">
                    Fin{type === 'TEMPORARY' ? '' : ' (opcional)'}
                  </span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setEndDate(event.target.value)
                    }}
                    aria-label="Fecha de fin"
                  />
                </label>
              </div>
              {IS_DEV_UI && (
                <code className="-mt-2 text-[11px] text-ink-4">
                  validity · daterange, no dos fechas sueltas
                </code>
              )}
              {type === 'TEMPORARY' && (
                <p className="text-xs text-ink-3">
                  Una asignación temporal necesita fecha de fin: mientras dure, el colaborador está
                  en Café y al vencer vuelve a su estado anterior.
                </p>
              )}

              {workerId === '' ? (
                <p className="text-xs text-ink-3">Elige a un colaborador para asignar</p>
              ) : type === 'TEMPORARY' && endDate === '' ? (
                <p className="text-xs text-ink-3">Una asignación temporal necesita fecha de fin</p>
              ) : null}
              <Button
                variant="primary"
                disabled={!canSubmit}
                onClick={() => {
                  void submit()
                }}
              >
                {isSaving ? 'Asignando…' : 'Asignar colaborador'}
              </Button>

              {hasFailed && (
                <p role="alert" className="text-sm text-red">
                  {assignErrorMessage(saveError)}
                </p>
              )}

              <p className="text-xs leading-relaxed text-ink-4">
                {IS_DEV_UI ? (
                  <>
                    Gana el primero, y lo hace cumplir el motor: RR-15 se resuelve con{' '}
                    <code>SKIP LOCKED</code> sobre la fila del slot (D-02) — dos reclutadoras
                    simultáneas y solo una gana; la otra recibe 409.
                  </>
                ) : (
                  'Gana la primera que confirma: si alguien se adelanta, el tablero se actualiza al momento.'
                )}
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

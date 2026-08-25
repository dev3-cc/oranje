import { useEffect, useState, type ReactNode } from 'react'

import { useCreateBlacklistEntryMutation, useGetWorkerBlacklistQuery } from '../api/blacklistApi'
import { useGetWorkerPoolQuery } from '../api/poolApi'
import { EMPTY_POOL_FILTERS } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { Select } from '@/shared/components/Select'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { WORKER_STATUS_TOKEN, workerStatusChipLabel } from '@/shared/constants/workerStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 transition-colors hover:border-ink-4 focus:outline-none focus-visible:border-o-500 focus-visible:ring-2 focus-visible:ring-o-500/30'

function InfoField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-ink-4">{label}</span>
      <span className="text-right text-sm text-ink-2">{value}</span>
    </div>
  )
}

export function CreateBlacklistDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const [workerId, setWorkerId] = useState('')
  const [reason, setReason] = useState('')
  const [evidencePath, setEvidencePath] = useState('')

  const { data: pool } = useGetWorkerPoolQuery(EMPTY_POOL_FILTERS, { skip: !isOpen })
  const { data: history = [] } = useGetWorkerBlacklistQuery(workerId, {
    skip: workerId === '',
  })
  const [createEntry, { isLoading, error }] = useCreateBlacklistEntryMutation()

  useEffect(() => {
    if (!isOpen) return
    setWorkerId('')
    setReason('')
    setEvidencePath('')
  }, [isOpen])

  const worker = pool?.items.find((item) => item.id === workerId) ?? null
  const previousLifted = history.filter((entry) => !entry.isActive).length
  const hasActiveVeto = history.some((entry) => entry.isActive)
  const isProtected = worker?.status === 'GRAY'

  const canSubmit =
    worker !== null &&
    !isProtected &&
    !hasActiveVeto &&
    reason.trim() !== '' &&
    evidencePath.trim() !== '' &&
    !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit || worker === null) return
    try {
      await createEntry({
        workerId: worker.id,
        reason: reason.trim(),
        evidencePath: evidencePath.trim(),
      }).unwrap()
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar a Blacklist"
      description={
        IS_DEV_UI
          ? 'coverage.blacklist_entry · nueva fila con veto vigente — ux_blacklist_worker impide un segundo veto activo'
          : 'El veto entra vigente; el historial de la persona nunca se borra'
      }
      className="max-w-xl"
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? 'Vetando…' : 'Vetar colaborador'}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">Colaborador</span>
        <Select
          value={workerId}
          onChange={(event) => {
            setWorkerId(event.target.value)
          }}
          className={CONTROL_CLASS}
        >
          <option value="">Elige a la persona…</option>
          {(pool?.items ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName}
            </option>
          ))}
        </Select>
      </label>

      {worker && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-ink">{worker.fullName}</p>
              <p className="text-sm text-ink-3">
                {worker.catalogPosition} · Zona {worker.zoneName}
              </p>
            </div>
            <StatusLightSoftBadge
              token={WORKER_STATUS_TOKEN[worker.status]}
              label={workerStatusChipLabel(worker.status)}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-4">
            <InfoField label="worker_state" value={worker.status} />
            <InfoField
              label="accidents_open"
              value={isProtected ? 'está en GRIS — protegido' : '0 · no está en GRIS'}
            />
            <InfoField
              label="vetoes_previos"
              value={
                hasActiveVeto
                  ? 'ya tiene un veto VIGENTE'
                  : previousLifted > 0
                    ? `${String(previousLifted)} · levantados`
                    : 'ninguno'
              }
            />
          </div>

          {isProtected && (
            <p className="rounded-md bg-yellow/15 px-4 py-3 text-sm text-ink-2">
              El GRIS protege: un colaborador accidentado no se puede vetar.
            </p>
          )}
          {hasActiveVeto && (
            <p className="rounded-md bg-yellow/15 px-4 py-3 text-sm text-ink-2">
              Ya hay un veto vigente para esta persona: levántalo antes de registrar otro.
            </p>
          )}
        </>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">
          Motivo del veto <span className="font-normal text-ink-3">(obligatorio)</span>
          {IS_DEV_UI && <code className="text-xs font-normal text-ink-4"> · reason</code>}
        </span>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
          }}
          rows={3}
          placeholder="P. ej. «Abandonó el turno sin aviso en dos ocasiones.»"
          className={CONTROL_CLASS}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">
          Evidencia <span className="font-normal text-ink-3">(obligatoria en un veto manual)</span>
          {IS_DEV_UI && <code className="text-xs font-normal text-ink-4"> · evidence_path</code>}
        </span>
        {}
        <input
          type="text"
          value={evidencePath}
          onChange={(event) => {
            setEvidencePath(event.target.value)
          }}
          placeholder="evidencia-turnos.pdf"
          className={CONTROL_CLASS}
        />
      </label>

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        Origen <span className="font-semibold">MANUAL</span> — los vetos por ausencias o disputa los
        genera el sistema. Al vetar, el semáforo de la persona pasa a{' '}
        <span className="font-semibold">Negro</span> y sale del Pool.
      </p>

      {error !== undefined && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            fallback:
              'No se pudo registrar el veto. El motor pudo rechazarlo: el GRIS protege y solo hay un veto vigente a la vez.',
          })}
        </p>
      )}
    </Modal>
  )
}

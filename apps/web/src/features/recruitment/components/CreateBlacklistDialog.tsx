import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useCreateBlacklistEntryMutation, useGetWorkerBlacklistQuery } from '../api/blacklistApi'
import { useGetWorkerPoolQuery } from '../api/poolApi'
import { EMPTY_POOL_FILTERS } from '../types/pool.types'

import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeHastaPronto from '@/assets/ilustrations/personaje-hasta-pronto.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  WORKER_STATUS_LABEL,
  WORKER_STATUS_TOKEN,
  workerStatusChipLabel,
} from '@/shared/constants/workerStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

function InfoField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-ink-4">{label}</span>
      <span className="text-right text-sm text-ink-2">{value}</span>
    </div>
  )
}

const INTRO_SLIDES = [
  {
    image: personajeAcceso,
    title: 'El Gris protege',
    text: 'Una persona en accidente laboral no puede vetarse: primero se resuelve su caso, luego se decide.',
  },
  {
    image: personajeEncuesta,
    title: 'Motivo y evidencia, obligatorios',
    text: 'El veto siempre carga su porqué y su respaldo — sin evidencia no hay veto.',
  },
  {
    image: personajeHastaPronto,
    title: 'Un solo veto vigente',
    text: 'Sale del Pool mientras el veto viva; el historial completo queda y solo el Administrador lo levanta.',
  },
] as const

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

  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setShowIntro(true)
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
          : 'El veto queda vigente desde ahora; el historial de la persona nunca se borra'
      }
      className="max-w-xl"
      footer={
        showIntro ? null : (
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
        )
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Continuar"
          onDone={() => {
            setShowIntro(false)
          }}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="blacklist-worker" className="text-sm font-semibold text-ink">
              Colaborador
            </label>
            <Select {...(workerId ? { value: workerId } : {})} onValueChange={setWorkerId}>
              <SelectTrigger id="blacklist-worker" aria-label="Colaborador" className="w-full">
                <SelectValue placeholder="Elige a la persona…" />
              </SelectTrigger>
              <SelectContent>
                {(pool?.items ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                <InfoField
                  label={IS_DEV_UI ? 'worker_state' : 'Estado'}
                  value={IS_DEV_UI ? worker.status : WORKER_STATUS_LABEL[worker.status]}
                />
                <InfoField
                  label={IS_DEV_UI ? 'accidents_open' : 'Accidente abierto'}
                  value={
                    IS_DEV_UI
                      ? isProtected
                        ? 'está en GRIS — protegido'
                        : '0 · no está en GRIS'
                      : isProtected
                        ? 'Sí: está en Gris y protegido'
                        : 'No'
                  }
                />
                <InfoField
                  label={IS_DEV_UI ? 'vetoes_previos' : 'Vetos anteriores'}
                  value={
                    hasActiveVeto
                      ? IS_DEV_UI
                        ? 'ya tiene un veto VIGENTE'
                        : 'Uno vigente ahora mismo'
                      : previousLifted > 0
                        ? `${String(previousLifted)} ${previousLifted === 1 ? 'levantado' : 'levantados'}`
                        : 'Ninguno'
                  }
                />
              </div>

              {isProtected && (
                <p className="rounded-md bg-yellow/15 px-4 py-3 text-sm text-ink-2">
                  {IS_DEV_UI
                    ? 'El GRIS protege: un colaborador accidentado no se puede vetar.'
                    : 'Está en Gris por un accidente laboral: no se puede vetar hasta que su caso se resuelva.'}
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
            <Textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
              }}
              rows={3}
              placeholder="P. ej. «Abandonó el turno sin aviso en dos ocasiones.»"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">
              Evidencia{' '}
              <span className="font-normal text-ink-3">(obligatoria en un veto manual)</span>
              {IS_DEV_UI && (
                <code className="text-xs font-normal text-ink-4"> · evidence_path</code>
              )}
            </span>
            {}
            <Input
              type="text"
              value={evidencePath}
              onChange={(event) => {
                setEvidencePath(event.target.value)
              }}
              placeholder="evidencia-turnos.pdf"
            />
          </label>

          <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
            Este veto es <span className="font-semibold">manual</span>; los vetos por ausencias o
            disputa los genera el sistema. Al vetar, la persona pasa a{' '}
            <span className="font-semibold">Negro</span> y sale del Pool de Colaboradores.
          </p>

          {error !== undefined && (
            <p role="alert" className="text-sm text-red">
              {apiErrorMessage(error, {
                fallback:
                  'No se pudo registrar el veto. Revisa que la persona no esté en Gris ni tenga ya un veto vigente, e inténtalo de nuevo.',
              })}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}

import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, AlertDescription, cn, MaterialIcon, toast } from '@oranje/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  useCreateAuditMutation,
  useGetAuditQuery,
  useGetChecklistItemsQuery,
  useUpdateAuditMutation,
} from '../api/auditsApi'
import type { AuditType, ChecklistItem, ResponseValue } from '../types/audit.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const RESPONSE_OPTIONS: ReadonlyArray<{
  value: ResponseValue
  label: MessageDescriptor
  icon: string
}> = [
  { value: 'CUMPLE', label: msg`Cumple`, icon: 'check' },
  { value: 'NO', label: msg`No`, icon: 'close' },
  { value: 'N/A', label: msg`N/A`, icon: 'remove' },
]

/** El pill CUMPLE queda en verde, NO en rojo, N/A neutro: el color nunca es la única señal (lleva icono + texto). */
const OPTION_ACTIVE_CLASS: Record<ResponseValue, string> = {
  CUMPLE: 'border-green bg-green/15 text-green',
  NO: 'border-red bg-red/15 text-red',
  'N/A': 'border-line bg-surface-3 text-ink-2',
}

function scoreOf(
  items: ChecklistItem[],
  responses: Record<string, ResponseValue | undefined>,
): number | null {
  let earned = 0
  let possible = 0
  for (const item of items) {
    const value = responses[item.id]
    if (value === undefined || value === 'N/A') continue
    const weight = Number(item.weight)
    possible += weight
    if (value === 'CUMPLE') earned += weight
  }
  if (possible === 0) return null
  return Math.round((earned / possible) * 100)
}

function groupByCategory(items: ChecklistItem[]): Array<[string, ChecklistItem[]]> {
  const groups = new Map<string, ChecklistItem[]>()
  for (const item of items) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  return [...groups.entries()]
}

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function auditErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      WORKER_REQUIRED: i18n._(msg`Elige a quién se audita antes de guardar.`),
      WORKER_NOT_ASSIGNED_TO_HOTEL: i18n._(
        msg`Ese colaborador ya no tiene asignación activa en este hotel.`,
      ),
      AUDIT_ALL_NA: i18n._(msg`No se puede calificar una auditoría donde todo quedó en N/A.`),
      RESPONSE_NOT_FOUND: i18n._(
        msg`Uno de los reactivos ya no es parte de esta auditoría. Recarga e inténtalo de nuevo.`,
      ),
      CHECKLIST_ITEM_NOT_FOUND: i18n._(
        msg`Uno de los reactivos ya no existe. Recarga e inténtalo de nuevo.`,
      ),
      HOTEL_OUT_OF_SCOPE: i18n._(msg`Esta auditoría no es de tu hotel.`),
    },
    fallback: i18n._(msg`No se pudo guardar la auditoría. Inténtalo de nuevo.`),
  })
}

export interface AuditFormDialogProps {
  auditType: AuditType
  hotelId: string
  /** Solo PERSONAL_PRESENTATION: a quién se audita. */
  worker?: { id: string; fullName: string; photoUrl: string | null }
  title: string
  description: string
  /** Con id: se abre en modo CORREGIR — precarga y guarda con PATCH. */
  auditId?: string
  onClose: () => void
  onSaved?: () => void
}

/**
 * El formulario de las dos auditorías: header, reactivos por categoría con
 * pills CUMPLE/NO/N/A, observaciones y el score preliminar EN VIVO (preview
 * del cliente; el score real y final lo calcula y devuelve el back al
 * guardar). `PersonalPresentationAuditDialog` y `EnvironmentAuditDialog` solo
 * fijan `worker`/textos — el 90% del layout es este componente.
 */
export function AuditFormDialog({
  auditType,
  hotelId,
  worker,
  title,
  description,
  auditId,
  onClose,
  onSaved,
}: AuditFormDialogProps): ReactNode {
  const { t, i18n } = useLingui()
  const { data: items, isLoading: isLoadingItems } = useGetChecklistItemsQuery(auditType)
  const { data: existing, isLoading: isLoadingExisting } = useGetAuditQuery(auditId ?? '', {
    skip: !auditId,
  })

  const [responses, setResponses] = useState<Record<string, ResponseValue | undefined>>({})
  const [observations, setObservations] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [createAudit, { isLoading: isCreating }] = useCreateAuditMutation()
  const [updateAudit, { isLoading: isUpdating }] = useUpdateAuditMutation()
  const isSaving = isCreating || isUpdating

  useEffect(() => {
    if (!existing) return
    setResponses(Object.fromEntries(existing.responses.map((r) => [r.checklistItemId, r.value])))
    setObservations(existing.observations ?? '')
  }, [existing])

  const groups = useMemo(() => groupByCategory(items ?? []), [items])
  const preliminaryScore = useMemo(() => scoreOf(items ?? [], responses), [items, responses])
  const answeredCount = Object.values(responses).filter((v) => v !== undefined).length
  const totalCount = (items ?? []).length
  const allAnswered = totalCount > 0 && answeredCount === totalCount
  const isLoading = isLoadingItems || (Boolean(auditId) && isLoadingExisting)

  function setValue(itemId: string, value: ResponseValue): void {
    setResponses((prev) => ({ ...prev, [itemId]: value }))
  }

  async function save(): Promise<void> {
    setError(null)
    const payloadResponses = Object.entries(responses)
      .filter((entry): entry is [string, ResponseValue] => entry[1] !== undefined)
      .map(([checklistItemId, value]) => ({ checklistItemId, value }))

    try {
      if (auditId) {
        await updateAudit({
          id: auditId,
          responses: payloadResponses,
          ...(observations.trim() !== '' ? { observations: observations.trim() } : {}),
        }).unwrap()
        toast.success(t`Auditoría corregida`)
      } else {
        await createAudit({
          auditType,
          hotelId,
          ...(worker ? { workerId: worker.id } : {}),
          ...(observations.trim() !== '' ? { observations: observations.trim() } : {}),
          responses: payloadResponses,
        }).unwrap()
        toast.success(t`Auditoría guardada`)
      }
      onSaved?.()
      onClose()
    } catch (saveError) {
      setError(auditErrorMessage(saveError, i18n))
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-3xl"
      footer={
        !isLoading && (
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-14 shrink-0 items-center justify-center rounded-full border-4 text-lg font-bold',
                  preliminaryScore === null
                    ? 'border-line text-ink-4'
                    : preliminaryScore >= 80
                      ? 'border-green text-green'
                      : preliminaryScore >= 60
                        ? 'border-yellow text-ink'
                        : 'border-red text-red',
                )}
              >
                {preliminaryScore === null ? '—' : `${String(preliminaryScore)}%`}
              </span>
              <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                <Trans>Calificación preliminar</Trans>
                <span className="block text-[11px] font-normal normal-case text-ink-4">
                  <Trans>
                    {answeredCount} de {totalCount} contestados
                  </Trans>
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={onClose} disabled={isSaving}>
                <Trans>Cancelar</Trans>
              </Button>
              <Button
                variant="primary"
                disabled={!allAnswered || isSaving}
                title={
                  !allAnswered ? t`Contesta todos los reactivos para poder guardar` : undefined
                }
                onClick={() => {
                  void save()
                }}
              >
                <MaterialIcon name="save" className="text-base" aria-hidden />
                {isSaving ? t`Guardando…` : t`Finalizar auditoría`}
              </Button>
            </div>
          </div>
        )
      }
    >
      {worker && (
        <div className="flex items-center gap-2.5">
          {worker.photoUrl ? (
            <img
              src={worker.photoUrl}
              alt=""
              className="size-10 shrink-0 rounded-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-o-500 text-sm font-bold text-ink"
            >
              {worker.fullName.charAt(0)}
            </span>
          )}
          <p className="text-sm text-ink-2">
            <Trans>
              Auditando a <span className="font-semibold text-ink">{worker.fullName}</span>
            </Trans>
          </p>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} columns={2} />
      ) : (items ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
          <Trans>
            Todavía no hay reactivos para esta auditoría. Pídele al Administrador que los agregue en
            Catálogos.
          </Trans>
          {IS_DEV_UI && (
            <code className="block text-xs text-ink-4">catalogs.audit_checklist_item</code>
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([category, groupItems]) => (
            <section key={category}>
              <h3 className="border-b border-line pb-1.5 text-xs font-bold tracking-wide text-o-700 uppercase">
                {category}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {groupItems.map((item) => {
                  const value = responses[item.id]
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-2">
                        {value === undefined && (
                          <MaterialIcon
                            name="warning"
                            aria-hidden
                            className="shrink-0 text-base text-yellow"
                          />
                        )}
                        {item.label}
                      </span>
                      <span
                        role="group"
                        aria-label={t`Respuesta para ${item.label}`}
                        className="flex gap-1.5"
                      >
                        {RESPONSE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={value === option.value}
                            onClick={() => {
                              setValue(item.id, option.value)
                            }}
                            className={cn(
                              'flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                              value === option.value
                                ? OPTION_ACTIVE_CLASS[option.value]
                                : 'border-line bg-surface text-ink-3 hover:bg-surface-3',
                            )}
                          >
                            <MaterialIcon name={option.icon} className="text-sm" aria-hidden />
                            {i18n._(option.label)}
                          </button>
                        ))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">
              <Trans>
                Observaciones generales <span className="font-normal text-ink-3">(opcional)</span>
              </Trans>
            </span>
            <textarea
              value={observations}
              onChange={(event) => {
                setObservations(event.target.value)
              }}
              rows={3}
              placeholder={t`Lo que viste y que vale la pena dejar por escrito…`}
              className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
            />
          </label>

          {error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Modal>
  )
}

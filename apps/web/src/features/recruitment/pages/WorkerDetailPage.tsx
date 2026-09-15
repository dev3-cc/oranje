import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Select,
  statusLight,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useCreateWorkerDocumentMutation,
  useDeleteWorkerDocumentMutation,
  useGetWorkerDetailQuery,
  useGetWorkerDocumentsQuery,
  useGetWorkerHistoryQuery,
  useVerifyWorkerDocumentMutation,
} from '../api/workerDetailApi'
import { ChangeStateDialog } from '../components/ChangeStateDialog'
import { CreateWorkerDialog } from '../components/CreateWorkerDialog'

import { useUploadFileMutation } from '@/app/filesApi'
import personajeTalento from '@/assets/ilustrations/personaje-talento.svg'
import mascotaTriste from '@/assets/mascota/mascota-triste.png'
import { Button } from '@/shared/components/Button'
import { CautionPill } from '@/shared/components/CautionPill'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  BLOOD_LABEL,
  EXPERIENCE_LABEL,
  GENDER_LABEL,
  RELATIONSHIP_LABEL,
  TRANSPORT_LABEL,
} from '@/shared/constants/workerEnums'
import {
  workerStatusChipLabel,
  WORKER_STATUS_LABEL,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

/** Se traduce al pintar con `i18n._()` (D-36). */
const DOCUMENT_TYPE_LABEL: Record<string, MessageDescriptor> = {
  SSN_ITIN: msg`SSN / ITIN`,
  ID: msg`Identificación oficial`,
  PROOF_OF_ADDRESS: msg`Comprobante de domicilio`,
  OTHER: msg`Otro`,
}

/** En dev el historial habla en códigos (documentación viva); en build, en el nombre del estado. */
function stateName(code: string): string {
  return IS_DEV_UI ? code : (WORKER_STATUS_LABEL[code as WorkerStatus] ?? code)
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

function Field({
  label,
  value,
  foot,
  icon,
}: {
  label: string
  value: string
  foot: string
  icon?: string
}): ReactNode {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      {icon !== undefined && (
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2"
        >
          <MaterialIcon name={icon} className="text-base text-ink-3" />
        </span>
      )}
      <span className="min-w-0">
        <p className="text-xs text-ink-3">{label}</p>
        <p className="mt-0.5 text-sm font-medium break-words text-ink">{value}</p>
        {/* El pie de dev cabe donde caiga, sin partirse palabra por palabra. */}
        {IS_DEV_UI && (
          <code className="block text-[11px] leading-snug break-words text-ink-4">{foot}</code>
        )}
      </span>
    </div>
  )
}

/**
 * Los campos que integran `is_profile_complete`, con su clave estable: la
 * clave decide qué se puede arreglar desde «Editar» (Fase 1) y la etiqueta es
 * lo único que se traduce al pintar (D-36).
 */
const PROFILE_FIELDS = [
  { key: 'position', label: msg`Posición`, isPhase1: true },
  { key: 'english', label: msg`Inglés`, isPhase1: true },
  { key: 'modality', label: msg`Modalidad`, isPhase1: true },
  { key: 'experience', label: msg`Experiencia`, isPhase1: true },
  { key: 'transport', label: msg`Transporte`, isPhase1: false },
  { key: 'emergencyContact', label: msg`Contacto de emergencia`, isPhase1: false },
  { key: 'bloodType', label: msg`Tipo de sangre`, isPhase1: false },
] as const

export function WorkerDetailPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { workerId = '' } = useParams()
  const [isChangeOpen, setChangeOpen] = useState(false)
  const [isEditOpen, setEditOpen] = useState(false)
  const can = useCan()
  /** Mover el semáforo y verificar documentos es de quien valida (recruitment:validate_signup). */
  const canValidate = can('recruitment:validate_signup')
  const canEditDocuments = can('recruitment:update_worker')

  const {
    data: worker,
    isLoading,
    isError,
  } = useGetWorkerDetailQuery(workerId, { skip: workerId === '' })
  const { data: history = [] } = useGetWorkerHistoryQuery(workerId, { skip: workerId === '' })
  const { data: documents } = useGetWorkerDocumentsQuery(workerId, { skip: workerId === '' })

  /** Alta de documento: el archivo primero al bucket, luego la fila del expediente. */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadType, setUploadType] = useState('ID')
  const [uploadFile, { isLoading: isUploadingFile }] = useUploadFileMutation()
  const [createDocument, { isLoading: isSavingDocument }] = useCreateWorkerDocumentMutation()
  const [verifyDocument] = useVerifyWorkerDocumentMutation()
  const [deleteDocument] = useDeleteWorkerDocumentMutation()
  const [documentError, setDocumentError] = useState<string | null>(null)
  /** Borrar pide segundo clic sobre la misma fila. */
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const isUploading = isUploadingFile || isSavingDocument

  function documentTypeLabel(documentType: string): string {
    const label = DOCUMENT_TYPE_LABEL[documentType]
    return label === undefined ? documentType : i18n._(label)
  }

  async function handleDocumentFile(file: File): Promise<void> {
    setDocumentError(null)
    try {
      const stored = await uploadFile({ file, purpose: 'WORKER_DOCUMENT' }).unwrap()
      await createDocument({ workerId, documentType: uploadType, filePath: stored.path }).unwrap()
      toast.success(t`Documento subido`)
    } catch (error) {
      setDocumentError(
        apiErrorMessage(error, {
          byCode: {
            UNSUPPORTED_FILE_TYPE: t`Ese formato no se puede procesar (los HEIC del iPhone no entran): usa JPG, PNG, WebP o PDF.`,
            /* El mensaje del backend interpola el tipo en mayúsculas (`SSN_ITIN`),
               que el filtro anti-fuga descarta entero por no ser una sigla
               reconocida — caía al genérico justo en el caso más común: volver
               a subir el SSN/ITIN sin borrar el anterior. */
            DOCUMENT_ALREADY_EXISTS: t`Ya hay un documento de ${documentTypeLabel(uploadType)}: bórralo antes de subir otro.`,
          },
          byStatus: {
            413: t`El archivo pasa de 15 MB: comprímelo o escanéalo con menos resolución.`,
          },
          fallback: t`No se pudo subir el documento. Inténtalo de nuevo.`,
        }),
      )
    }
  }

  async function handleDelete(documentId: string): Promise<void> {
    if (confirmingDeleteId !== documentId) {
      setConfirmingDeleteId(documentId)
      return
    }
    setConfirmingDeleteId(null)
    try {
      await deleteDocument({ workerId, documentId }).unwrap()
      toast.success(t`Documento borrado`)
    } catch {
      setDocumentError(t`No se pudo borrar el documento. Inténtalo de nuevo.`)
    }
  }

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (isError || !worker) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface p-8 text-center">
        <img src={mascotaTriste} alt="" aria-hidden className="h-32 w-auto" />
        <p className="text-sm text-red">
          <Trans>
            No se encontró al colaborador: puede que el enlace sea viejo o que ya no esté en el
            Pool.
          </Trans>
        </p>
        <Link to="/collaborator-pool" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver al Pool de Colaboradores</Trans>
        </Link>
      </div>
    )
  }

  const status = worker.state.code as WorkerStatus
  const statusLabel = workerStatusChipLabel(status)

  const identityFields = [
    { label: t`Nombre completo`, value: worker.fullName, foot: 'full_name', icon: 'person' },
    {
      label: t`Nacimiento`,
      value: t`${formatDate(worker.birthDate)} · ${worker.age} años`,
      foot: 'birth_date · la edad se calcula en vw_worker',
      icon: 'cake',
    },
    {
      label: t`Género`,
      value: GENDER_LABEL[worker.gender] ?? worker.gender,
      foot: 'gender',
      icon: 'face',
    },
    { label: t`Teléfono`, value: worker.phone, foot: 'phone', icon: 'call' },
    { label: t`Zona`, value: worker.zone.name, foot: 'zone_id', icon: 'map' },
    {
      label: t`Usuario del sistema`,
      value: worker.email ?? t`Sin cuenta todavía`,
      foot: 'user_id · nulable — sin cuenta hasta el primer login',
      icon: 'account_circle',
    },
    { label: t`Dirección`, value: worker.address, foot: 'address', icon: 'home' },
  ]

  /** Espejo exacto de `personal.vw_worker.is_profile_complete` (§4 de Estándares
      de Desarrollo): lo que ahí es un booleano ciego, aquí es la lista de qué
      falta — antes «el expediente está a medias» no decía de qué. */
  const missingKeys: Record<string, boolean> = {
    position: worker.position === null,
    english: worker.englishLevel === null,
    modality: worker.hiringModality === null,
    experience: worker.experienceLevel === null,
    transport: worker.transportType === null,
    emergencyContact: worker.emergencyContact === null,
    bloodType: worker.bloodType === null,
  }
  const missing = worker.isProfileComplete
    ? []
    : PROFILE_FIELDS.filter((field) => missingKeys[field.key])
  const missingProfileFields = missing.map((field) => i18n._(field.label))

  /** Solo la Fase 1 (Posición, Inglés, Modalidad, Experiencia) la edita
      Reclutamiento con «Editar»; Transporte y Fase 3 los completa el
      colaborador desde su app — «Editar» no puede tocarlos. */
  const canFixMissingFromHere = missing.every((field) => field.isPhase1)

  const profileFields = [
    {
      label: t`Posición`,
      value: worker.position?.name ?? '—',
      foot: 'catalog_position_id',
      icon: 'badge',
    },
    {
      label: t`Inglés`,
      value: worker.englishLevel?.name ?? '—',
      foot: 'english_level_id',
      icon: 'translate',
    },
    {
      label: t`Modalidad`,
      value: worker.hiringModality?.name ?? '—',
      foot: 'hiring_modality_id',
      icon: 'work',
    },
    {
      label: t`Experiencia`,
      value:
        worker.experienceLevel === null
          ? '—'
          : (EXPERIENCE_LABEL[worker.experienceLevel] ?? worker.experienceLevel),
      foot: 'experience_level',
      icon: 'trending_up',
    },
    {
      label: t`Transporte`,
      value:
        worker.transportType === null
          ? '—'
          : (TRANSPORT_LABEL[worker.transportType] ?? worker.transportType),
      foot: 'transport_type',
      icon: 'commute',
    },
    {
      label: t`Tipo de sangre`,
      value: worker.bloodType === null ? '—' : (BLOOD_LABEL[worker.bloodType] ?? worker.bloodType),
      foot: 'blood_type',
      icon: 'bloodtype',
    },
    {
      label: t`Contacto de emergencia`,
      value: worker.emergencyContact?.name ?? '—',
      foot: 'emergency_contact_name',
      icon: 'contact_phone',
    },
    {
      label: t`Teléfono de emergencia`,
      value: worker.emergencyContact?.phone ?? '—',
      foot: 'emergency_contact_phone',
      icon: 'call',
    },
    {
      label: t`Parentesco`,
      value:
        worker.emergencyContact === null
          ? '—'
          : (RELATIONSHIP_LABEL[worker.emergencyContact.relationship] ??
            worker.emergencyContact.relationship),
      foot: 'emergency_contact_relationship',
      icon: 'group',
    },
    {
      label: t`Notas médicas`,
      value: '—',
      foot: 'medical_notes · el contrato de /workers/:id no la expone',
      icon: 'medical_services',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/collaborator-pool" className="hover:text-o-700">
          <Trans>Pool de Colaboradores</Trans>
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">{worker.fullName}</span>
      </nav>

      {/* La PORTADA (referencia de Hugo): banda de degradado de marca, el
          avatar traslapando el borde con el semáforo como anillo, el estado
          junto al nombre y desde cuándo está en el Pool. */}
      <header className="overflow-hidden rounded-xl border border-line bg-surface">
        <div aria-hidden className="h-24 bg-gradient-to-r from-o-500/35 via-o-50 to-o-500/15" />
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5">
          <div>
            {worker.photoUrl ? (
              <img
                src={worker.photoUrl}
                alt=""
                style={{ borderColor: statusLight[WORKER_STATUS_TOKEN[status]] }}
                className="-mt-10 size-20 rounded-full border-2 object-cover ring-4 ring-surface"
              />
            ) : (
              <span
                aria-hidden
                style={{ borderColor: statusLight[WORKER_STATUS_TOKEN[status]] }}
                className="-mt-10 flex size-20 items-center justify-center rounded-full border-2 bg-o-50 text-xl font-bold text-o-700 ring-4 ring-surface"
              >
                {initialsOf(worker.fullName)}
              </span>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-ink">{worker.fullName}</h1>
              {/* El estado pegado al nombre, como el «Verified» de la referencia. */}
              <StatusLightSoftBadge token={WORKER_STATUS_TOKEN[status]} label={statusLabel} />
              {worker.isBlacklisted && (
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-surface">
                  <Trans>En Blacklist</Trans>
                </span>
              )}
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <MaterialIcon name="event" className="text-base" aria-hidden />
                <Trans>En el Pool desde el {formatDate(worker.createdAt)}</Trans>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MaterialIcon name="map" className="text-base" aria-hidden />
                {worker.zone.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MaterialIcon name="badge" className="text-base" aria-hidden />
                {worker.position?.name ?? t`Sin posición`}
              </span>
            </p>

            {/* Las EXCEPCIONES hablan en voz baja, con icono + palabras. */}
            {(!worker.isProfileComplete || !worker.hasTaxId) && (
              <p className="mt-2.5 flex flex-wrap items-center gap-2">
                {!worker.isProfileComplete && (
                  <CautionPill>
                    <Trans>Perfil incompleto</Trans>
                  </CautionPill>
                )}
                {!worker.hasTaxId && (
                  <CautionPill>
                    <Trans>Sin ITIN: aplica retención del 16%{IS_DEV_UI ? ' (D-27)' : ''}</Trans>
                  </CautionPill>
                )}
              </p>
            )}
          </div>

          {/* `ml-auto`: si envuelve a su propia línea, se pega a la derecha en
              vez de quedar descolgada en medio. */}
          <div className="mt-4 ml-auto flex gap-2">
            {canEditDocuments ? (
              <Button
                onClick={() => {
                  setEditOpen(true)
                }}
              >
                <Trans>Editar</Trans>
              </Button>
            ) : null}
            {canValidate ? (
              <Button
                variant="primary"
                onClick={() => {
                  setChangeOpen(true)
                }}
              >
                <Trans>Cambiar estado</Trans>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Quién sigue: mover el semáforo y verificar documentos es de quien valida. */}
      {!canValidate && (
        <NoticeCard
          image={personajeTalento}
          title={t`El semáforo lo mueve Reclutamiento`}
          role="status"
        >
          <Trans>
            El estado del colaborador y la verificación de sus documentos los lleva la Reclutadora o
            el Líder de Grupo. Aquí consultas su expediente y su historial.
          </Trans>
        </NoticeCard>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <SectionCard
            title={t`Identidad`}
            subtitle={
              IS_DEV_UI
                ? 'las seis son NOT NULL — sin ellas no hay Fase 1'
                : t`Sin estos datos no hay Fase 1`
            }
          >
            <div className="@container">
              <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
                {identityFields.map((field) => (
                  <Field key={field.foot} {...field} />
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t`Perfil laboral y salud`}
            subtitle={
              IS_DEV_UI
                ? 'todas nulables · 9 integran is_profile_complete (vw_worker) — la foto no cuenta'
                : t`Con estos 9 datos el perfil queda completo; la foto no cuenta`
            }
          >
            <div className="@container">
              <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
                {profileFields.map((field) => (
                  <Field key={field.foot} {...field} />
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t`Documentos`}
            subtitle={
              IS_DEV_UI
                ? 'personal.worker_document'
                : t`Sube y verifica los documentos del Expediente`
            }
          >
            {/* Alta: tipo + archivo. Verificar el SSN/ITIN NO levanta la retención del
                16% — ese cálculo lee `has_tax_id` (columna cifrada que hoy nadie
                escribe, D-27/D-33), no `worker_document.verified_at`. Verificar aquí
                solo marca el documento como revisado. */}
            {canEditDocuments && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-surface-2 p-3">
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger aria-label={t`Tipo de documento`} className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(DOCUMENT_TYPE_LABEL).map((value) => (
                      <SelectItem key={value} value={value}>
                        {documentTypeLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  disabled={isUploading}
                  onClick={() => {
                    fileInputRef.current?.click()
                  }}
                >
                  {isUploading ? <Trans>Subiendo…</Trans> : <Trans>Subir documento</Trans>}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  aria-label={t`Archivo del documento`}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void handleDocumentFile(file)
                  }}
                />
                {documentError && (
                  <p role="alert" className="w-full text-xs text-red">
                    {documentError}
                  </p>
                )}
              </div>
            )}

            {(documents?.data ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">
                <Trans>Aún no hay documentos. Elige el tipo y súbelo desde aquí arriba.</Trans>
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {(documents?.data ?? []).map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-52 text-sm font-medium text-ink">
                      {documentTypeLabel(doc.documentType)}
                    </span>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-o-700 hover:underline"
                      >
                        {doc.filePath.split('/').pop()}
                      </a>
                    ) : (
                      <span className="text-sm text-ink-2">{doc.filePath.split('/').pop()}</span>
                    )}
                    <span className="ml-auto text-xs text-ink-3">
                      {doc.verifiedBy?.fullName ?? '—'}
                    </span>
                    <span className="w-24 text-xs text-ink-3">
                      {doc.verifiedAt === null ? '—' : formatDate(doc.verifiedAt)}
                    </span>
                    <span
                      className={
                        doc.isVerified
                          ? 'rounded-full bg-green/15 px-3 py-1 text-xs font-medium text-ink-2'
                          : 'rounded-full border border-dashed border-ink-4 px-3 py-1 text-xs text-ink-3'
                      }
                    >
                      {doc.isVerified ? <Trans>Verificado</Trans> : <Trans>Pendiente</Trans>}
                    </span>
                    {!doc.isVerified && canValidate && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        title={t`Marca el documento como revisado. No afecta la retención del 16% del SSN/ITIN.`}
                        onClick={() => {
                          void verifyDocument({ workerId, documentId: doc.id })
                            .unwrap()
                            .then(() => {
                              toast.success(t`Documento verificado`)
                            })
                            .catch(() => {})
                        }}
                      >
                        <Trans>Verificar documento</Trans>
                      </Button>
                    )}
                    {canEditDocuments && (
                      <button
                        type="button"
                        aria-label={t`Borrar ${documentTypeLabel(doc.documentType)}`}
                        title={
                          confirmingDeleteId === doc.id
                            ? t`Otro clic lo borra definitivamente`
                            : t`Borrar el documento`
                        }
                        onClick={() => {
                          void handleDelete(doc.id)
                        }}
                        className={`cursor-pointer rounded-md p-1.5 transition-colors hover:bg-surface-2 ${
                          confirmingDeleteId === doc.id ? 'text-red' : 'text-ink-3 hover:text-red'
                        }`}
                      >
                        <MaterialIcon
                          name={confirmingDeleteId === doc.id ? 'delete_forever' : 'delete'}
                          className="text-lg"
                        />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {IS_DEV_UI && (
              <code className="mt-3 block text-[11px] text-ink-4">
                document_type · file_path · verified_by · verified_at
              </code>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title={t`Historial del semáforo`}
          subtitle={
            IS_DEV_UI
              ? 'personal.worker_state_history — la verdad del semáforo'
              : t`Cada cambio de estado, con quién lo hizo y cuándo`
          }
          className="self-start"
        >
          {history.length === 0 ? (
            <p className="text-sm text-ink-3">
              <Trans>Aún no hay cambios de estado.</Trans>
            </p>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-5">
              {history.map((entry) => (
                <li key={entry.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute top-1 -left-[26px] size-2.5 rounded-full bg-o-500"
                  />
                  <p className="text-sm font-semibold text-ink">
                    {entry.fromState === null ? '—' : stateName(entry.fromState)} →{' '}
                    {stateName(entry.toState)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {formatDate(entry.occurredAt)} · {entry.userName}
                  </p>
                  {entry.reason !== null && (
                    <p className="mt-0.5 text-xs text-ink-2">{entry.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <ChangeStateDialog
        workerId={worker.id}
        currentStatus={status}
        currentLabel={statusLabel}
        isOpen={isChangeOpen}
        onClose={() => {
          setChangeOpen(false)
        }}
        missingProfileFields={missingProfileFields}
        canFixMissingFromHere={canFixMissingFromHere}
      />

      {/* Antes esto solo se podía desde el Pool: aquí, viendo justo qué falta
          («Perfil incompleto» + la lista), es donde de verdad hace falta. */}
      <CreateWorkerDialog
        isOpen={isEditOpen}
        workerId={worker.id}
        onClose={() => {
          setEditOpen(false)
        }}
      />
    </div>
  )
}

import {
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

import { useUploadFileMutation } from '@/app/filesApi'
import mascotaTriste from '@/assets/mascota/mascota-triste.png'
import { Button } from '@/shared/components/Button'
import { LoadingState } from '@/shared/components/LoadingState'
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
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  SSN_ITIN: 'SSN / ITIN',
  ID: 'Identificación oficial',
  PROOF_OF_ADDRESS: 'Comprobante de domicilio',
  OTHER: 'Otro',
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

function Field({ label, value, foot }: { label: string; value: string; foot: string }): ReactNode {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink" title={value}>
        {value}
      </p>
      {IS_DEV_UI && <code className="text-[11px] text-ink-4">{foot}</code>}
    </div>
  )
}

export function WorkerDetailPage(): ReactNode {
  const { workerId = '' } = useParams()
  const [isChangeOpen, setChangeOpen] = useState(false)

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

  async function handleDocumentFile(file: File): Promise<void> {
    setDocumentError(null)
    try {
      const stored = await uploadFile({ file, purpose: 'WORKER_DOCUMENT' }).unwrap()
      await createDocument({ workerId, documentType: uploadType, filePath: stored.path }).unwrap()
    } catch (error) {
      setDocumentError(
        apiErrorMessage(error, {
          byCode: {
            UNSUPPORTED_FILE_TYPE:
              'Ese formato no se puede procesar (los HEIC del iPhone no entran): usa JPG, PNG, WebP o PDF.',
          },
          byStatus: {
            413: 'El archivo pasa de 15 MB: comprímelo o escanéalo con menos resolución.',
          },
          fallback: 'No se pudo subir el documento. Inténtalo de nuevo.',
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
    } catch {
      setDocumentError('No se pudo borrar el documento. Inténtalo de nuevo.')
    }
  }

  if (isLoading) {
    return <LoadingState label="Cargando el expediente…" />
  }

  if (isError || !worker) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface p-8 text-center">
        <img src={mascotaTriste} alt="" aria-hidden className="h-32 w-auto" />
        <p className="text-sm text-red">No se encontró al colaborador.</p>
        <Link to="/pool-colaboradores" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al Pool
        </Link>
      </div>
    )
  }

  const status = worker.state.code as WorkerStatus
  const statusLabel = workerStatusChipLabel(status)

  const identityFields = [
    { label: 'Nombre completo', value: worker.fullName, foot: 'full_name' },
    {
      label: 'Nacimiento',
      value: `${formatDate(worker.birthDate)} · ${String(worker.age)} años`,
      foot: 'birth_date · la edad se calcula en vw_worker',
    },
    { label: 'Género', value: GENDER_LABEL[worker.gender] ?? worker.gender, foot: 'gender' },
    { label: 'Teléfono', value: worker.phone, foot: 'phone' },
    { label: 'Zona', value: worker.zone.name, foot: 'zone_id' },
    {
      label: 'Usuario del sistema',
      value: worker.hasAccount ? 'Con cuenta' : '—',
      foot: 'user_id · nulable — sin cuenta hasta el primer login',
    },
    { label: 'Dirección', value: worker.address, foot: 'address' },
  ]

  const profileFields = [
    { label: 'Posición', value: worker.position?.name ?? '—', foot: 'catalog_position_id' },
    { label: 'Inglés', value: worker.englishLevel?.name ?? '—', foot: 'english_level_id' },
    { label: 'Modalidad', value: worker.hiringModality?.name ?? '—', foot: 'hiring_modality_id' },
    {
      label: 'Experiencia',
      value:
        worker.experienceLevel === null
          ? '—'
          : (EXPERIENCE_LABEL[worker.experienceLevel] ?? worker.experienceLevel),
      foot: 'experience_level',
    },
    {
      label: 'Transporte',
      value:
        worker.transportType === null
          ? '—'
          : (TRANSPORT_LABEL[worker.transportType] ?? worker.transportType),
      foot: 'transport_type',
    },
    {
      label: 'Tipo de sangre',
      value: worker.bloodType === null ? '—' : (BLOOD_LABEL[worker.bloodType] ?? worker.bloodType),
      foot: 'blood_type',
    },
    {
      label: 'Contacto de emergencia',
      value: worker.emergencyContact?.name ?? '—',
      foot: 'emergency_contact_name',
    },
    {
      label: 'Teléfono de emergencia',
      value: worker.emergencyContact?.phone ?? '—',
      foot: 'emergency_contact_phone',
    },
    {
      label: 'Parentesco',
      value:
        worker.emergencyContact === null
          ? '—'
          : (RELATIONSHIP_LABEL[worker.emergencyContact.relationship] ??
            worker.emergencyContact.relationship),
      foot: 'emergency_contact_relationship',
    },
    {
      label: 'Notas médicas',
      value: '—',
      foot: 'medical_notes · el contrato de /workers/:id no la expone',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/pool-colaboradores" className="hover:text-o-700">
          Pool de Colaboradores
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">{worker.fullName}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {worker.photoUrl ? (
            <img
              src={worker.photoUrl}
              alt=""
              className="size-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-o-50 text-base font-bold text-o-700"
            >
              {initialsOf(worker.fullName)}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-ink">{worker.fullName}</h1>
            <p className="mt-0.5 text-xs text-ink-3">
              {IS_DEV_UI && 'personal.worker · '}
              {worker.zone.name} · {worker.position?.name ?? 'Sin posición'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusLightSoftBadge token={WORKER_STATUS_TOKEN[status]} label={statusLabel} />
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">
                {worker.isProfileComplete ? 'Perfil completo' : 'Perfil incompleto'}
              </span>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">
                {worker.hasTaxId
                  ? 'ITIN registrado'
                  : `Sin ITIN · retención 16%${IS_DEV_UI ? ' (D-27)' : ''}`}
              </span>
              {worker.isBlacklisted && (
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-surface">
                  En Blacklist
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setChangeOpen(true)
          }}
        >
          Cambiar estado
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <SectionCard
            title="Identidad"
            subtitle={
              IS_DEV_UI
                ? 'las seis son NOT NULL — sin ellas no hay Fase 1'
                : 'Sin estos datos no hay Fase 1'
            }
          >
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              {identityFields.map((field) => (
                <Field key={field.foot} {...field} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Perfil laboral y salud"
            subtitle={
              IS_DEV_UI
                ? 'todas nulables · 9 integran is_profile_complete (vw_worker) — la foto no cuenta'
                : '9 campos obligatorios completan el perfil — la foto no cuenta'
            }
          >
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              {profileFields.map((field) => (
                <Field key={field.foot} {...field} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Documentos"
            subtitle={IS_DEV_UI ? 'personal.worker_document' : 'El expediente del colaborador'}
          >
            {/* Alta: tipo + archivo. Verificar el SSN/ITIN es lo que levanta la retención. */}
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-surface-2 p-3">
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger aria-label="Tipo de documento" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
                {isUploading ? 'Subiendo…' : 'Subir documento'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                aria-label="Archivo del documento"
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

            {(documents?.data ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">
                Sin documentos en el expediente.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {(documents?.data ?? []).map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-52 text-sm font-medium text-ink">
                      {DOCUMENT_TYPE_LABEL[doc.documentType] ?? doc.documentType}
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
                      {doc.isVerified ? 'Verificado' : 'Pendiente'}
                    </span>
                    {!doc.isVerified && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        title="Verificar el documento (si es el SSN/ITIN, levanta la retención)"
                        onClick={() => {
                          void verifyDocument({ workerId, documentId: doc.id })
                        }}
                      >
                        Verificar
                      </Button>
                    )}
                    <button
                      type="button"
                      aria-label={`Borrar ${DOCUMENT_TYPE_LABEL[doc.documentType] ?? doc.documentType}`}
                      title={
                        confirmingDeleteId === doc.id
                          ? 'Otro clic lo borra definitivamente'
                          : 'Borrar el documento'
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
          title="Historial del semáforo"
          subtitle={
            IS_DEV_UI
              ? 'personal.worker_state_history — la verdad del semáforo'
              : 'Cada cambio de estado, con quién lo hizo y cuándo'
          }
          className="self-start"
        >
          {history.length === 0 ? (
            <p className="text-sm text-ink-3">Sin movimientos registrados.</p>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-5">
              {history.map((entry) => (
                <li key={entry.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute top-1 -left-[26px] size-2.5 rounded-full bg-o-500"
                  />
                  <p className="text-sm font-semibold text-ink">
                    {entry.fromState ?? '—'} → {entry.toState}
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
        currentLabel={statusLabel}
        isOpen={isChangeOpen}
        onClose={() => {
          setChangeOpen(false)
        }}
      />
    </div>
  )
}

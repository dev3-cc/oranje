import { MaterialIcon } from '@oranje/ui'
import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'

import {
  useCreateWorkerMutation,
  useGetPoolOptionsQuery,
  useUpdateWorkerMutation,
} from '../api/poolApi'
import { useGetWorkerDetailQuery } from '../api/workerDetailApi'

import { useUploadFileMutation } from '@/app/filesApi'
import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { isCompletePhone, PhoneInput } from '@/shared/components/PhoneInput'
import { EXPERIENCE_LABEL, EXPERIENCE_LEVELS } from '@/shared/constants/workerEnums'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

/**
 * Select con chevron propio: el nativo pinta su flecha con el cromo del
 * sistema y desentona con los inputs — `appearance-none` + Material Icon.
 */
function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }): ReactNode {
  return (
    <span className="relative w-full">
      <select {...props} className={`${CONTROL_CLASS} cursor-pointer appearance-none pr-10`}>
        {children}
      </select>
      <MaterialIcon
        name="expand_more"
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-lg text-ink-3"
      />
    </span>
  )
}

const GENDERS = [
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'OTHER', label: 'Otro' },
] as const

/** Qué pasa después del alta: las cinco verdades de la maqueta, tal cual. */
const AFTERMATH = [
  'Nace en BLANCO: la fila existe a medias, eso ES el estado (D-26).',
  'El colaborador completa Fase 2 (transporte y SSN/ITIN, con 3 días de plazo) y Fase 3 (emergencia y salud) en la app.',
  'is_profile_complete vive en vw_worker: los campos obligatorios los declara la vista, sin NOT NULL.',
  'La Reclutadora valida el alta (RF-08) → pasa a VERDE FUERTE y entra al Pool.',
  'Sin SSN/ITIN, la retención del 16% aplica automática (D-27).',
]

interface Draft {
  fullName: string
  birthDate: string
  /** Ruta del bucket que devolvió POST /files; vacío = sin foto. */
  photoPath: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  phone: string
  address: string
  zoneId: string
  /** Decisiones de Oranje (2026-08-22): las captura la Reclutadora, no el candidato. */
  catalogPositionId: string
  hiringModalityId: string
  englishLevelId: string
  experienceLevel: string
}

const EMPTY_DRAFT: Draft = {
  fullName: '',
  birthDate: '',
  photoPath: '',
  gender: 'FEMALE',
  phone: '',
  address: '',
  zoneId: '',
  catalogPositionId: '',
  hiringModalityId: '',
  englishLevelId: '',
  experienceLevel: '',
}

/** Una fila del formulario: etiqueta a la izquierda, control a la derecha. */
function FormRow({
  label,
  column,
  children,
}: {
  label: string
  column?: string
  children: ReactNode
}): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-line px-6 py-4 sm:grid-cols-[190px_1fr] sm:gap-6">
      <span className="pt-2.5 text-sm font-medium text-ink-2">
        {label}
        {IS_DEV_UI && column && <code className="block text-[11px] text-ink-4">{column}</code>}
      </span>
      <div className="flex gap-3">{children}</div>
    </div>
  )
}

/**
 * Del error de la API a una frase que diga QUÉ corregir: el back ya distingue
 * el HEIC del iPhone (UNSUPPORTED_FILE_TYPE) del archivo gigante (413) — el
 * genérico «inténtalo de nuevo» escondía justo eso.
 */
function uploadErrorMessage(error: unknown): string {
  return apiErrorMessage(error, {
    byCode: {
      UNSUPPORTED_FILE_TYPE:
        'Ese formato no se puede procesar (los HEIC del iPhone no entran): usa JPG, PNG o WebP.',
    },
    byStatus: {
      413: 'La imagen pasa de 15 MB: toma la foto con menos resolución o comprímela.',
    },
    fallback: 'No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.',
  })
}

/** La fecha tope del picker: hoy menos 18 años — el back rechaza menores. */
function maxBirthDate(): string {
  const limit = new Date()
  limit.setFullYear(limit.getFullYear() - 18)
  return limit.toISOString().slice(0, 10)
}

/** La causa REAL del rechazo del alta, no el «revisa los datos» a ciegas. */
function saveErrorMessage(error: unknown): string {
  return apiErrorMessage(error, {
    byCode: {
      WORKER_UNDERAGE: (info) =>
        `${info.message ?? 'Menor de edad'} — revisa la fecha de nacimiento.`,
    },
    fallback: 'No se pudo guardar el colaborador. Revisa los datos e inténtalo de nuevo.',
  })
}

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/**
 * Crear colaborador — Fase 1 · Entrevista, en el patrón de ficha de usuario:
 * banda con la escena 3D de la naranja, avatar encimado y filas de etiqueta a
 * la izquierda. La identidad MÁS las decisiones de Oranje sobre el perfil —
 * posición, modalidad, inglés y experiencia dejaron de ser datos que el
 * colaborador declara (Colaborador.md, 2026-08-22). Van opcionales: la fila
 * nace a medias a propósito, eso ES el estado Blanco (`POST /workers`, D-26).
 */
export function CreateWorkerDialog({
  isOpen,
  onClose,
  workerId,
}: {
  isOpen: boolean
  onClose: () => void
  /** Con id, el MISMO modal edita: precarga el expediente y guarda con PATCH. */
  workerId?: string
}): ReactNode {
  const isEditing = workerId !== undefined
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const { data: options } = useGetPoolOptionsQuery(undefined, { skip: !isOpen })
  const { data: editing } = useGetWorkerDetailQuery(workerId ?? '', {
    skip: !isOpen || !isEditing,
  })
  const [createWorker, { isLoading: isCreating, isError: hasCreateFailed, error: createError }] =
    useCreateWorkerMutation()
  const [updateWorker, { isLoading: isUpdating, isError: hasUpdateFailed, error: updateError }] =
    useUpdateWorkerMutation()
  const isLoading = isCreating || isUpdating
  const isError = hasCreateFailed || hasUpdateFailed
  const saveError = hasUpdateFailed ? updateError : createError

  /** La foto se pica en el avatar de la banda: sube a POST /files y previsualiza local. */
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadPhoto, { isLoading: isUploading, isError: isUploadError, error: uploadError }] =
    useUploadFileMutation()

  useEffect(() => {
    if (!isOpen) return
    setDraft(EMPTY_DRAFT)
    setPhotoPreview(null)
  }, [isOpen])

  /** Modo edición: el expediente llena el formulario y la foto ya guardada. */
  useEffect(() => {
    if (!isOpen || !editing) return
    setDraft({
      fullName: editing.fullName,
      birthDate: editing.birthDate.slice(0, 10),
      photoPath: '',
      gender: editing.gender as Draft['gender'],
      phone: editing.phone,
      address: editing.address,
      zoneId: editing.zone.id,
      catalogPositionId: editing.position?.id ?? '',
      hiringModalityId: editing.hiringModality?.id ?? '',
      englishLevelId: editing.englishLevel?.id ?? '',
      experienceLevel: editing.experienceLevel ?? '',
    })
    setPhotoPreview(editing.photoUrl)
  }, [isOpen, editing])

  async function handlePhoto(file: File): Promise<void> {
    setPhotoPreview(URL.createObjectURL(file))
    try {
      const stored = await uploadPhoto({ file, purpose: 'WORKER_PHOTO' }).unwrap()
      update('photoPath')(stored.path)
    } catch {
      /* el error queda en `isUploadError` y se pinta bajo el header */
    }
  }

  const update =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]): void => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    }

  const canSubmit =
    draft.fullName.trim() !== '' &&
    draft.birthDate !== '' &&
    isCompletePhone(draft.phone) &&
    draft.address.trim() !== '' &&
    draft.zoneId !== '' &&
    !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      if (isEditing && workerId) {
        /** El PATCH no acepta nacimiento ni género: son inmutables del alta. */
        await updateWorker({
          workerId,
          fullName: draft.fullName.trim(),
          phone: draft.phone.trim(),
          address: draft.address.trim(),
          zoneId: draft.zoneId,
          ...(draft.photoPath !== '' ? { photoPath: draft.photoPath } : {}),
          ...(draft.catalogPositionId !== '' ? { catalogPositionId: draft.catalogPositionId } : {}),
          ...(draft.hiringModalityId !== '' ? { hiringModalityId: draft.hiringModalityId } : {}),
          ...(draft.englishLevelId !== '' ? { englishLevelId: draft.englishLevelId } : {}),
          ...(draft.experienceLevel !== '' ? { experienceLevel: draft.experienceLevel } : {}),
        }).unwrap()
      } else {
        await createWorker({
          fullName: draft.fullName.trim(),
          birthDate: draft.birthDate,
          gender: draft.gender,
          phone: draft.phone.trim(),
          address: draft.address.trim(),
          zoneId: draft.zoneId,
          ...(draft.photoPath !== '' ? { photoPath: draft.photoPath } : {}),
          ...(draft.catalogPositionId !== '' ? { catalogPositionId: draft.catalogPositionId } : {}),
          ...(draft.hiringModalityId !== '' ? { hiringModalityId: draft.hiringModalityId } : {}),
          ...(draft.englishLevelId !== '' ? { englishLevelId: draft.englishLevelId } : {}),
          ...(draft.experienceLevel !== '' ? { experienceLevel: draft.experienceLevel } : {}),
        }).unwrap()
      }
      onClose()
    } catch {
      /* el error queda en `isError` y se pinta abajo */
    }
  }

  const initials = initialsOf(draft.fullName)

  /** Con el botón apagado, DECIR qué falta — no dejar adivinando. */
  const missingHint =
    draft.fullName.trim() === ''
      ? 'Falta el nombre completo'
      : draft.birthDate === ''
        ? 'Falta la fecha de nacimiento'
        : !isCompletePhone(draft.phone)
          ? 'El teléfono necesita al menos 7 dígitos (sin contar la lada)'
          : draft.address.trim() === ''
            ? 'Falta el domicilio'
            : draft.zoneId === ''
              ? 'Elige la zona'
              : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar colaborador' : 'Crear colaborador — Fase 1 · Entrevista'}
      chromeless
      className="max-w-2xl"
    >
      <div className="flex max-h-[calc(100vh-3rem)] flex-col overflow-y-auto">
        {/* La banda: gradiente cálido + la naranja 3D flotando (si hay WebGL). */}
        <div className="relative h-36 shrink-0 bg-gradient-to-r from-o-50 via-o-50/70 to-surface-2">
          {/* El personaje de Contratación del sistema de marca, completo
              dentro de la banda: más alto que ella y el modal le corta la
              cabeza. Sin animación: quieto se ve mejor. */}
          <img
            src={personajeContratacion}
            alt=""
            aria-hidden
            className="absolute right-10 bottom-2 h-32 w-auto"
          />
          {/* El avatar ES el control de la foto: picar carga o reemplaza.
              Sobresale de la banda a propósito — nada lo recorta. */}
          <button
            type="button"
            aria-label={photoPreview ? 'Reemplazar foto' : 'Subir foto'}
            title={photoPreview ? 'Reemplazar foto' : 'Subir foto'}
            disabled={isUploading}
            onClick={() => {
              photoInputRef.current?.click()
            }}
            className="group absolute -bottom-12 left-8 z-10 size-24 cursor-pointer rounded-full border-4 border-surface bg-o-50 shadow-md transition-shadow hover:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-o-500 disabled:cursor-wait"
          >
            <span className="block size-full overflow-hidden rounded-full">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="size-full object-cover" />
              ) : initials !== '' ? (
                <span
                  aria-hidden
                  className="flex size-full items-center justify-center text-2xl font-bold text-o-700"
                >
                  {initials}
                </span>
              ) : (
                <span aria-hidden className="flex size-full items-center justify-center">
                  <MaterialIcon name="photo_camera" className="text-3xl text-o-700" />
                </span>
              )}
              <span
                aria-hidden
                className="absolute inset-x-1 bottom-1 rounded-full bg-ink/60 py-0.5 text-center text-[10px] font-semibold text-surface opacity-0 transition-opacity group-hover:opacity-100"
              >
                {isUploading ? 'Subiendo…' : photoPreview ? 'Cambiar' : 'Subir foto'}
              </span>
            </span>
            {/* El sello de cámara dice sin hover que esto se pica. */}
            <span
              aria-hidden
              className="absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-o-500 text-ink shadow-sm"
            >
              <MaterialIcon name="photo_camera" className="text-base" />
            </span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            /* Sin `image/*`: el back no abre HEIC, y al excluirlo iOS convierte
               la foto a JPEG solo. */
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            className="hidden"
            aria-label="Foto del colaborador"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handlePhoto(file)
            }}
          />
        </div>

        <header className="px-8 pt-16 pb-5">
          <h2 className="text-xl font-bold text-ink">
            {draft.fullName.trim() === '' ? 'Nuevo colaborador' : draft.fullName}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {isEditing ? 'Editar expediente' : 'Fase 1 · Entrevista'}
            {IS_DEV_UI && !isEditing && ' — personal.worker · nace en BLANCO'}
            {IS_DEV_UI && <code className="text-[11px] text-ink-4"> · photo_path</code>}
          </p>
          {isUploadError && (
            <p role="alert" className="mt-1 text-xs text-red">
              {uploadErrorMessage(uploadError)}
            </p>
          )}
        </header>

        <FormRow label="Nombre completo" column="full_name">
          <input
            value={draft.fullName}
            onChange={(event) => {
              update('fullName')(event.target.value)
            }}
            aria-label="Nombre completo"
            placeholder="María Sandoval Ruiz"
            className={CONTROL_CLASS}
          />
        </FormRow>

        <FormRow label="Nacimiento y género" column="birth_date · gender">
          <input
            type="date"
            value={draft.birthDate}
            onChange={(event) => {
              update('birthDate')(event.target.value)
            }}
            aria-label="Fecha de nacimiento"
            /* El back exige 18+: el picker no ofrece fechas que van a rebotar. */
            max={maxBirthDate()}
            disabled={isEditing}
            title={isEditing ? 'El nacimiento no se edita: es del alta' : undefined}
            className={CONTROL_CLASS}
          />
          <Select
            value={draft.gender}
            onChange={(event) => {
              update('gender')(event.target.value as Draft['gender'])
            }}
            aria-label="Género"
            disabled={isEditing}
            title={isEditing ? 'El género no se edita: es del alta' : undefined}
          >
            {GENDERS.map((gender) => (
              <option key={gender.value} value={gender.value}>
                {gender.label}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Teléfono y zona" column="phone · zone_id">
          <PhoneInput
            value={draft.phone}
            onChange={(value) => {
              update('phone')(value)
            }}
            ariaLabel="Teléfono"
            placeholder="404 790 2517"
          />
          <Select
            value={draft.zoneId}
            onChange={(event) => {
              update('zoneId')(event.target.value)
            }}
            aria-label="Zona"
          >
            <option value="">Elige la zona…</option>
            {(options?.zones ?? []).map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Domicilio" column="address">
          <input
            value={draft.address}
            onChange={(event) => {
              update('address')(event.target.value)
            }}
            aria-label="Domicilio"
            placeholder="1280 Peachtree St NE, Atlanta"
            className={CONTROL_CLASS}
          />
        </FormRow>

        <div className="border-t border-line bg-surface-2/60 px-6 py-3">
          <h3 className="text-sm font-semibold text-ink">Decisiones de Oranje sobre su perfil</h3>
          <p className="text-xs text-ink-4">
            Las define la Reclutadora en la entrevista; el candidato ya no las declara
          </p>
        </div>

        <FormRow label="Posición y modalidad" column="catalog_position_id · hiring_modality_id">
          <Select
            value={draft.catalogPositionId}
            onChange={(event) => {
              update('catalogPositionId')(event.target.value)
            }}
            aria-label="Posición"
          >
            <option value="">Sin definir aún…</option>
            {(options?.positions ?? []).map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </Select>
          <Select
            value={draft.hiringModalityId}
            onChange={(event) => {
              update('hiringModalityId')(event.target.value)
            }}
            aria-label="Modalidad"
          >
            <option value="">Sin definir aún…</option>
            {(options?.modalities ?? []).map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Inglés y experiencia" column="english_level_id · experience_level">
          <Select
            value={draft.englishLevelId}
            onChange={(event) => {
              update('englishLevelId')(event.target.value)
            }}
            aria-label="Nivel de inglés"
          >
            <option value="">Sin definir aún…</option>
            {(options?.englishLevels ?? []).map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </Select>
          <Select
            value={draft.experienceLevel}
            onChange={(event) => {
              update('experienceLevel')(event.target.value)
            }}
            aria-label="Experiencia"
          >
            <option value="">Sin definir aún…</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EXPERIENCE_LABEL[level]}
              </option>
            ))}
          </Select>
        </FormRow>

        <details className="border-t border-line px-6 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink-3 select-none">
            Qué pasa después del alta
          </summary>
          <ul className="mt-2.5 flex flex-col gap-2">
            {AFTERMATH.map((line) => (
              <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-ink-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-o-500" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </details>

        {isError && (
          <p role="alert" className="px-6 pb-2 text-sm text-red">
            {saveErrorMessage(saveError)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
          {missingHint !== null && (
            <span className="mr-auto text-xs text-ink-3">{missingHint}</span>
          )}
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
            {isLoading ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear colaborador'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

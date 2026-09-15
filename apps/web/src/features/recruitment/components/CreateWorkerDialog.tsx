import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Input,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  useCreateWorkerMutation,
  useGetPoolOptionsQuery,
  useUpdateWorkerMutation,
} from '../api/poolApi'
import { useGetWorkerDetailQuery } from '../api/workerDetailApi'

import { useUploadFileMutation } from '@/app/filesApi'
import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeGracias from '@/assets/ilustrations/personaje-gracias.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { isCompletePhone, PhoneInput } from '@/shared/components/PhoneInput'
import { EXPERIENCE_LABEL, EXPERIENCE_LEVELS } from '@/shared/constants/workerEnums'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const UNSET = 'UNSET'

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeContratacion,
    title: msg`La entrevista es la Fase 1`,
    text: msg`Posición, modalidad, inglés y experiencia se deciden aquí: son decisiones de Oranje, no del colaborador.`,
  },
  {
    image: personajeEncuesta,
    title: msg`El expediente se completa por fases`,
    text: msg`Nace en Blanco: el colaborador termina las fases 2 y 3 en su app — transporte y SSN/ITIN con 3 días de plazo.`,
  },
  {
    image: personajeGracias,
    title: msg`Validar lo hace entrar al Pool`,
    text: msg`Cuando valides el alta, pasa a Verde fuerte y queda disponible para asignarse a un hotel.`,
  },
]

const GENDERS = [
  { value: 'FEMALE', label: msg`Femenino` },
  { value: 'MALE', label: msg`Masculino` },
  { value: 'OTHER', label: msg`Otro` },
] as const

/** Documentación viva de dev: no se traduce (IS_DEV_UI). */
const AFTERMATH_DEV = [
  'Nace en BLANCO: la fila existe a medias, eso ES el estado (D-26).',
  'El colaborador completa Fase 2 (transporte y SSN/ITIN, con 3 días de plazo) y Fase 3 (emergencia y salud) en la app.',
  'is_profile_complete vive en vw_worker: los campos obligatorios los declara la vista, sin NOT NULL.',
  'La Reclutadora valida el alta (RF-08) → pasa a VERDE FUERTE y entra al Pool.',
  'Sin SSN/ITIN, la retención del 16% aplica automática (D-27).',
]

/** Lo que lee la persona; se traduce al pintar con `i18n._()` (D-36). */
const AFTERMATH_MESSAGE: readonly MessageDescriptor[] = [
  msg`Nace en Blanco: el expediente se completa por fases.`,
  msg`El colaborador completa la Fase 2 (transporte y SSN/ITIN, con 3 días de plazo) y la Fase 3 (contacto de emergencia y salud) desde su app.`,
  msg`Cuando la Reclutadora valida el alta, pasa a Verde fuerte y entra al Pool de Colaboradores.`,
  msg`Por ahora la retención del 16% aplica a todos los colaboradores, suban o verifiquen o no su SSN/ITIN — es temporal, mientras se conecta ese proceso.`,
]

interface Draft {
  fullName: string
  birthDate: string
  photoPath: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  phone: string
  address: string
  zoneId: string
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

/** El `i18n` viene del componente (D-36). */
function uploadErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      UNSUPPORTED_FILE_TYPE: i18n._(
        msg`Ese formato no se puede procesar (los HEIC del iPhone no entran): usa JPG, PNG o WebP.`,
      ),
    },
    byStatus: {
      413: i18n._(msg`La imagen pasa de 15 MB: toma la foto con menos resolución o comprímela.`),
    },
    fallback: i18n._(msg`No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.`),
  })
}

function maxBirthDate(): string {
  const limit = new Date()
  limit.setFullYear(limit.getFullYear() - 18)
  return limit.toISOString().slice(0, 10)
}

/** El `i18n` viene del componente (D-36). */
function saveErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      WORKER_UNDERAGE: (info) => {
        const reason = info.message ?? i18n._(msg`Es menor de edad`)
        return i18n._(msg`${reason}: revisa la fecha de nacimiento.`)
      },
    },
    fallback: i18n._(
      msg`No se pudo guardar el colaborador. Revisa los datos e inténtalo de nuevo.`,
    ),
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

export function CreateWorkerDialog({
  isOpen,
  onClose,
  workerId,
}: {
  isOpen: boolean
  onClose: () => void
  workerId?: string
}): ReactNode {
  const { t, i18n } = useLingui()
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

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadPhoto, { isLoading: isUploading, isError: isUploadError, error: uploadError }] =
    useUploadFileMutation()

  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('create-worker')

  useEffect(() => {
    if (!isOpen) return
    setDraft(EMPTY_DRAFT)
    setPhotoPreview(null)
  }, [isOpen, isEditing])

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
      toast.success(t`Foto subida`)
    } catch {
      return
    }
  }

  const update =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]): void => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    }

  /*
   * Editar es un PATCH parcial (el back acepta `Partial<CreateWorkerRequest>`):
   * un expediente migrado puede llegar con el domicilio u otro campo vacío, y
   * eso no debe bloquear guardar un cambio que no lo toca — Hugo reportó el
   * botón "sin detectar" el cambio de Posición cuando el domicilio real
   * seguía en blanco. Solo el alta (Fase 1) exige el expediente completo.
   */
  const canSubmit = isEditing
    ? draft.fullName.trim() !== '' &&
      (draft.phone === '' || isCompletePhone(draft.phone)) &&
      !isLoading
    : draft.fullName.trim() !== '' &&
      draft.birthDate !== '' &&
      isCompletePhone(draft.phone) &&
      draft.address.trim() !== '' &&
      draft.zoneId !== '' &&
      !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      if (isEditing && workerId) {
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
        toast.success(t`Colaborador actualizado`)
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
        const created = draft.fullName.trim()
        toast.success(t`Colaborador creado — ${created}`)
      }
      onClose()
    } catch {
      return
    }
  }

  const initials = initialsOf(draft.fullName)

  const missingHint = isEditing
    ? draft.fullName.trim() === ''
      ? t`Falta el nombre completo`
      : draft.phone !== '' && !isCompletePhone(draft.phone)
        ? t`El teléfono necesita al menos 7 dígitos (sin contar la lada)`
        : null
    : draft.fullName.trim() === ''
      ? t`Falta el nombre completo`
      : draft.birthDate === ''
        ? t`Falta la fecha de nacimiento`
        : !isCompletePhone(draft.phone)
          ? t`El teléfono necesita al menos 7 dígitos (sin contar la lada)`
          : draft.address.trim() === ''
            ? t`Falta el domicilio`
            : draft.zoneId === ''
              ? t`Elige la zona`
              : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t`Editar colaborador` : t`Crear colaborador — Fase 1 · Entrevista`}
      chromeless
      className="max-w-2xl"
    >
      <div className="flex max-h-[calc(100vh-3rem)] flex-col overflow-y-auto">
        {showIntro && !isEditing ? (
          <OnboardingIntro
            slides={INTRO_SLIDES.map((slide) => ({
              image: slide.image,
              title: i18n._(slide.title),
              text: i18n._(slide.text),
            }))}
            startLabel={t`Comenzar el alta`}
            onDone={() => {
              dismissIntro()
            }}
          />
        ) : (
          <>
            {}
            <div className="relative h-36 shrink-0 bg-gradient-to-r from-o-50 via-o-50/70 to-surface-2">
              {}
              <img
                src={personajeContratacion}
                alt=""
                aria-hidden
                className="absolute right-10 bottom-2 h-32 w-auto"
              />
              {}
              <button
                type="button"
                aria-label={photoPreview ? t`Reemplazar foto` : t`Subir foto`}
                title={photoPreview ? t`Reemplazar foto` : t`Subir foto`}
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
                    {isUploading ? t`Subiendo…` : photoPreview ? t`Cambiar` : t`Subir foto`}
                  </span>
                </span>
                {}
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
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                aria-label={t`Foto del colaborador`}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handlePhoto(file)
                }}
              />
            </div>

            <header className="px-8 pt-16 pb-5">
              <h2 className="text-xl font-bold text-ink">
                {draft.fullName.trim() === '' ? t`Nuevo colaborador` : draft.fullName}
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">
                {isEditing ? t`Editar expediente` : t`Fase 1 · Entrevista`}
                {IS_DEV_UI && !isEditing && ' — personal.worker · nace en BLANCO'}
                {IS_DEV_UI && <code className="text-[11px] text-ink-4"> · photo_path</code>}
              </p>
              {/* De solo lectura: el correo es el vínculo con Firebase, no se edita aquí. */}
              {isEditing && editing?.email && (
                <p className="mt-0.5 text-xs text-ink-3">{editing.email}</p>
              )}
              {isUploadError && (
                <p role="alert" className="mt-1 text-xs text-red">
                  {uploadErrorMessage(uploadError, i18n)}
                </p>
              )}
            </header>

            <FormRow label={t`Nombre completo`} column="full_name">
              <Input
                value={draft.fullName}
                onChange={(event) => {
                  update('fullName')(event.target.value)
                }}
                aria-label={t`Nombre completo`}
                placeholder={t`María Sandoval Ruiz`}
              />
            </FormRow>

            <FormRow label={t`Nacimiento y género`} column="birth_date · gender">
              <Input
                type="date"
                value={draft.birthDate}
                onChange={(event) => {
                  update('birthDate')(event.target.value)
                }}
                aria-label={t`Fecha de nacimiento`}
                max={maxBirthDate()}
                disabled={isEditing}
                title={
                  isEditing ? t`La fecha de nacimiento se fija en el alta y no se edita` : undefined
                }
              />
              <Select
                value={draft.gender}
                onValueChange={(value) => {
                  update('gender')(value as Draft['gender'])
                }}
                disabled={isEditing}
              >
                <SelectTrigger
                  aria-label={t`Género`}
                  title={isEditing ? t`El género se fija en el alta y no se edita` : undefined}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender.value} value={gender.value}>
                      {i18n._(gender.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>

            <FormRow label={t`Teléfono y zona`} column="phone · zone_id">
              <PhoneInput
                value={draft.phone}
                onChange={(value) => {
                  update('phone')(value)
                }}
                ariaLabel={t`Teléfono`}
                placeholder="404 790 2517"
              />
              <Select
                {...(draft.zoneId ? { value: draft.zoneId } : {})}
                onValueChange={update('zoneId')}
              >
                <SelectTrigger aria-label={t`Zona`} className="w-full">
                  <SelectValue placeholder={t`Elige la zona…`} />
                </SelectTrigger>
                <SelectContent>
                  {(options?.zones ?? []).map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>

            <FormRow label={t`Domicilio`} column="address">
              <Input
                value={draft.address}
                onChange={(event) => {
                  update('address')(event.target.value)
                }}
                aria-label={t`Domicilio`}
                placeholder="1280 Peachtree St NE, Atlanta"
              />
            </FormRow>

            <div className="border-t border-line bg-surface-2/60 px-6 py-3">
              <h3 className="text-sm font-semibold text-ink">
                <Trans>Decisiones de Oranje sobre su perfil</Trans>
              </h3>
              <p className="text-xs text-ink-4">
                <Trans>Las defines tú en la entrevista; el candidato no las declara</Trans>
              </p>
            </div>

            <FormRow
              label={t`Posición y modalidad`}
              column="catalog_position_id · hiring_modality_id"
            >
              <Select
                value={draft.catalogPositionId === '' ? UNSET : draft.catalogPositionId}
                onValueChange={(value) => {
                  update('catalogPositionId')(value === UNSET ? '' : value)
                }}
              >
                <SelectTrigger aria-label={t`Posición`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>
                    <Trans>Sin definir aún…</Trans>
                  </SelectItem>
                  {(options?.positions ?? []).map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={draft.hiringModalityId === '' ? UNSET : draft.hiringModalityId}
                onValueChange={(value) => {
                  update('hiringModalityId')(value === UNSET ? '' : value)
                }}
              >
                <SelectTrigger aria-label={t`Modalidad`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>
                    <Trans>Sin definir aún…</Trans>
                  </SelectItem>
                  {(options?.modalities ?? []).map((modality) => (
                    <SelectItem key={modality.id} value={modality.id}>
                      {modality.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>

            <FormRow label={t`Inglés y experiencia`} column="english_level_id · experience_level">
              <Select
                value={draft.englishLevelId === '' ? UNSET : draft.englishLevelId}
                onValueChange={(value) => {
                  update('englishLevelId')(value === UNSET ? '' : value)
                }}
              >
                <SelectTrigger aria-label={t`Nivel de inglés`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>
                    <Trans>Sin definir aún…</Trans>
                  </SelectItem>
                  {(options?.englishLevels ?? []).map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={draft.experienceLevel === '' ? UNSET : draft.experienceLevel}
                onValueChange={(value) => {
                  update('experienceLevel')(value === UNSET ? '' : value)
                }}
              >
                <SelectTrigger aria-label={t`Experiencia`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>
                    <Trans>Sin definir aún…</Trans>
                  </SelectItem>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {EXPERIENCE_LABEL[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>

            <details className="border-t border-line px-6 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink-3 select-none">
                <Trans>Qué pasa después del alta</Trans>
              </summary>
              <ul className="mt-2.5 flex flex-col gap-2">
                {(IS_DEV_UI ? AFTERMATH_DEV : AFTERMATH_MESSAGE.map((line) => i18n._(line))).map(
                  (line) => (
                    <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-ink-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-o-500" aria-hidden />
                      {line}
                    </li>
                  ),
                )}
              </ul>
            </details>

            {isError && (
              <p role="alert" className="px-6 pb-2 text-sm text-red">
                {saveErrorMessage(saveError, i18n)}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
              {missingHint !== null && (
                <span className="mr-auto text-xs text-ink-3">{missingHint}</span>
              )}
              <Button onClick={onClose} disabled={isLoading}>
                <Trans>Cancelar</Trans>
              </Button>
              <Button
                variant="primary"
                disabled={!canSubmit}
                onClick={() => {
                  void submit()
                }}
              >
                {isLoading ? t`Guardando…` : isEditing ? t`Guardar cambios` : t`Crear colaborador`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

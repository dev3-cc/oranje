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
import fotoColab2 from '@/assets/people-real/colab-2.webp'
import { Button } from '@/shared/components/Button'
import { DateField } from '@/shared/components/DateField'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { isCompletePhone, PhoneInput } from '@/shared/components/PhoneInput'
import { StepIndicator } from '@/shared/components/StepIndicator'
import {
  BLOOD_LABEL,
  BLOOD_TYPES,
  EXPERIENCE_LABEL,
  EXPERIENCE_LEVELS,
  RELATIONSHIP_LABEL,
  RELATIONSHIPS,
  TRANSPORT_LABEL,
  TRANSPORT_TYPES,
} from '@/shared/constants/workerEnums'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import type { WorkerApi } from '@/shared/types/apiContract.types'

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

/** Los 3 pasos del alta (Hugo, 2026-09-19): mismo patrón que Nueva Requisición. */
const WIZARD_STEPS: readonly { step: number; label: MessageDescriptor }[] = [
  { step: 1, label: msg`Datos personales` },
  { step: 2, label: msg`Decisiones de Oranje` },
  { step: 3, label: msg`Transporte y salud` },
]

/** El subtítulo que acompaña la foto lateral, según el paso activo. */
const STEP_SUBTITLE: Record<number, MessageDescriptor> = {
  1: msg`Fase 1 · Entrevista`,
  2: msg`Decisiones de Oranje sobre su perfil`,
  3: msg`Transporte, emergencia y salud — opcional`,
}

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
  /* Fases 2 y 3, opcionales: las llena el colaborador desde su app, pero si
     la Reclutadora ya las tiene en la entrevista las captura aquí y puede
     validar sin esperar. */
  transportType: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
  bloodType: string
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
  transportType: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  bloodType: '',
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
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  workerId?: string
  /** Solo en el alta: el colaborador recién creado, para encadenar el acceso. */
  onCreated?: (worker: WorkerApi) => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const isEditing = workerId !== undefined
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [step, setStep] = useState(1)
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
    setStep(1)
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
      transportType: editing.transportType ?? '',
      emergencyContactName: editing.emergencyContact?.name ?? '',
      emergencyContactPhone: editing.emergencyContact?.phone ?? '',
      emergencyContactRelationship: editing.emergencyContact?.relationship ?? '',
      bloodType: editing.bloodType ?? '',
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

  /* Solo el paso 1 (Datos personales) tiene campos obligatorios — 2 y 3 son
     decisiones/datos que se pueden dejar «sin definir aún». Avanzar del 1
     exige lo mismo que ya exige `canSubmit` en el alta. */
  const canLeaveStep1 = canSubmit

  function goNext(): void {
    if (step === 1 && !canLeaveStep1) return
    if (step < 3) setStep(step + 1)
  }

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      if (isEditing && workerId) {
        await updateWorker({
          workerId,
          fullName: draft.fullName.trim(),
          ...(draft.birthDate !== '' ? { birthDate: draft.birthDate } : {}),
          gender: draft.gender,
          phone: draft.phone.trim(),
          address: draft.address.trim(),
          zoneId: draft.zoneId,
          ...(draft.photoPath !== '' ? { photoPath: draft.photoPath } : {}),
          ...(draft.catalogPositionId !== '' ? { catalogPositionId: draft.catalogPositionId } : {}),
          ...(draft.hiringModalityId !== '' ? { hiringModalityId: draft.hiringModalityId } : {}),
          ...(draft.englishLevelId !== '' ? { englishLevelId: draft.englishLevelId } : {}),
          ...(draft.experienceLevel !== '' ? { experienceLevel: draft.experienceLevel } : {}),
          ...(draft.transportType !== '' ? { transportType: draft.transportType } : {}),
          ...(draft.emergencyContactName.trim() !== ''
            ? { emergencyContactName: draft.emergencyContactName.trim() }
            : {}),
          ...(isCompletePhone(draft.emergencyContactPhone)
            ? { emergencyContactPhone: draft.emergencyContactPhone.trim() }
            : {}),
          ...(draft.emergencyContactRelationship !== ''
            ? { emergencyContactRelationship: draft.emergencyContactRelationship }
            : {}),
          ...(draft.bloodType !== '' ? { bloodType: draft.bloodType } : {}),
        }).unwrap()
        toast.success(t`Colaborador actualizado`)
      } else {
        const createdWorker = await createWorker({
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
          ...(draft.transportType !== '' ? { transportType: draft.transportType } : {}),
          ...(draft.emergencyContactName.trim() !== ''
            ? { emergencyContactName: draft.emergencyContactName.trim() }
            : {}),
          ...(isCompletePhone(draft.emergencyContactPhone)
            ? { emergencyContactPhone: draft.emergencyContactPhone.trim() }
            : {}),
          ...(draft.emergencyContactRelationship !== ''
            ? { emergencyContactRelationship: draft.emergencyContactRelationship }
            : {}),
          ...(draft.bloodType !== '' ? { bloodType: draft.bloodType } : {}),
        }).unwrap()
        const created = draft.fullName.trim()
        toast.success(t`Colaborador creado — ${created}`)
        // El acceso (cuenta + buzón) es el siguiente paso natural del alta:
        // quien lo pide lo abre con el recién creado, sin buscarlo en el Pool.
        onCreated?.(createdWorker)
      }
      onClose()
    } catch {
      return
    }
  }

  const initials = initialsOf(draft.fullName)

  /* El tutorial del alta no se asoma al editar — y su ancho angosto tampoco. */
  const isIntroVisible = showIntro && !isEditing

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

  const photoUploadButton = (
    <button
      type="button"
      aria-label={photoPreview ? t`Reemplazar foto` : t`Subir foto`}
      title={photoPreview ? t`Reemplazar foto` : t`Subir foto`}
      disabled={isUploading}
      onClick={() => {
        photoInputRef.current?.click()
      }}
      className="group relative size-16 shrink-0 cursor-pointer rounded-full border-2 border-surface bg-o-50 shadow-sm transition-shadow hover:shadow-md focus:outline-2 focus:outline-offset-2 focus:outline-o-500 disabled:cursor-wait"
    >
      <span className="block size-full overflow-hidden rounded-full">
        {photoPreview ? (
          <img src={photoPreview} alt="" className="size-full object-cover" />
        ) : initials !== '' ? (
          <span
            aria-hidden
            className="flex size-full items-center justify-center text-lg font-bold text-o-700"
          >
            {initials}
          </span>
        ) : (
          <span aria-hidden className="flex size-full items-center justify-center">
            <MaterialIcon name="photo_camera" className="text-2xl text-o-700" />
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-o-500 text-ink shadow-sm"
      >
        <MaterialIcon name="photo_camera" className="text-xs" />
      </span>
    </button>
  )

  const photoInput = (
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
  )

  const aftermathDetails = (
    <details className="border-t border-line px-6 py-3">
      <summary className="cursor-pointer text-xs font-semibold text-ink-3 select-none">
        <Trans>Qué pasa después del alta</Trans>
      </summary>
      <ul className="mt-2.5 flex flex-col gap-2">
        {(IS_DEV_UI ? AFTERMATH_DEV : AFTERMATH_MESSAGE.map((line) => i18n._(line))).map((line) => (
          <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-ink-2">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-o-500" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </details>
  )

  const errorBanner = isError && (
    <p role="alert" className="px-6 pb-2 text-sm text-red">
      {saveErrorMessage(saveError, i18n)}
    </p>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t`Editar colaborador` : t`Crear colaborador`}
      chromeless
      className={isIntroVisible ? 'max-w-2xl' : 'max-w-4xl'}
    >
      {isIntroVisible ? (
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
        <div className="grid max-h-[calc(100vh-3rem)] grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="relative hidden overflow-hidden md:block">
            <img
              src={fotoColab2}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-[25%_35%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5"
            />
            <div className="relative flex h-full flex-col justify-end gap-2.5 p-6 text-surface">
              <p className="text-2xl leading-tight font-bold">
                {draft.fullName.trim() === '' ? t`Nuevo colaborador` : draft.fullName}
              </p>
              <p className="text-sm text-surface/85">
                {i18n._(STEP_SUBTITLE[step] ?? STEP_SUBTITLE[1]!)}
              </p>
            </div>
          </aside>

          <section className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col">
            <header className="border-b border-line px-6 py-5">
              {/* Al editar, el encabezado dice DE QUIÉN es el expediente: que el
                  diálogo se llama «Editar colaborador» ya lo dice su título. */}
              <h2 className="text-xl font-bold text-ink">
                {isEditing ? (
                  draft.fullName.trim() === '' ? (
                    <Trans>Editar colaborador</Trans>
                  ) : (
                    draft.fullName
                  )
                ) : (
                  <Trans>Crear colaborador</Trans>
                )}
              </h2>
              <p className="mt-1 text-sm text-ink-3">
                {isEditing
                  ? (editing?.email ?? t`Editar expediente`)
                  : IS_DEV_UI
                    ? 'personal.worker · nace en BLANCO'
                    : t`Nace en Blanco al guardar`}
              </p>
              <div className="mt-3">
                <StepIndicator
                  steps={WIZARD_STEPS.map((item) => ({
                    step: item.step,
                    label: i18n._(item.label),
                  }))}
                  current={step}
                  onStepClick={setStep}
                  allowAnyStep={isEditing}
                />
              </div>
            </header>

            <div className="flex flex-1 flex-col overflow-y-auto">
              {step === 1 && (
                <>
                  <FormRow label={t`Foto`} column="photo_path">
                    <div className="flex items-center gap-3">
                      {photoUploadButton}
                      <span className="text-xs text-ink-3">
                        {isUploading ? (
                          t`Subiendo…`
                        ) : (
                          <Trans>Opcional: puedes agregarla después desde el Pool</Trans>
                        )}
                      </span>
                    </div>
                    {photoInput}
                    {isUploadError && (
                      <p role="alert" className="text-xs text-red">
                        {uploadErrorMessage(uploadError, i18n)}
                      </p>
                    )}
                  </FormRow>

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
                    <DateField
                      value={draft.birthDate}
                      onChange={update('birthDate')}
                      aria-label={t`Fecha de nacimiento`}
                      max={maxBirthDate()}
                    />
                    <Select
                      value={draft.gender}
                      onValueChange={(value) => {
                        update('gender')(value as Draft['gender'])
                      }}
                    >
                      <SelectTrigger aria-label={t`Género`} className="w-full">
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
                </>
              )}

              {step === 2 && (
                <>
                  <div className="px-6 pt-5">
                    <p className="text-sm text-ink-3">
                      <Trans>Las defines tú en la entrevista; el candidato no las declara.</Trans>
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

                  <FormRow
                    label={t`Inglés y experiencia`}
                    column="english_level_id · experience_level"
                  >
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
                </>
              )}

              {step === 3 && (
                <>
                  <div className="px-6 pt-5">
                    <p className="text-sm text-ink-3">
                      <Trans>
                        Opcional: lo completa el colaborador desde su app, pero si ya lo tienes,
                        captúralo aquí y podrás validarlo sin esperar.
                      </Trans>
                    </p>
                  </div>

                  <FormRow
                    label={t`Transporte y tipo de sangre`}
                    column="transport_type · blood_type"
                  >
                    <Select
                      value={draft.transportType === '' ? UNSET : draft.transportType}
                      onValueChange={(value) => {
                        update('transportType')(value === UNSET ? '' : value)
                      }}
                    >
                      <SelectTrigger aria-label={t`Transporte`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET}>
                          <Trans>Sin definir aún…</Trans>
                        </SelectItem>
                        {TRANSPORT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {TRANSPORT_LABEL[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={draft.bloodType === '' ? UNSET : draft.bloodType}
                      onValueChange={(value) => {
                        update('bloodType')(value === UNSET ? '' : value)
                      }}
                    >
                      <SelectTrigger aria-label={t`Tipo de sangre`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET}>
                          <Trans>Sin definir aún…</Trans>
                        </SelectItem>
                        {BLOOD_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {BLOOD_LABEL[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormRow>

                  <FormRow
                    label={t`Contacto de emergencia`}
                    column="emergency_contact_name · emergency_contact_phone · emergency_contact_relationship"
                  >
                    <div className="flex w-full flex-col gap-3">
                      <Input
                        aria-label={t`Nombre del contacto de emergencia`}
                        placeholder={t`Nombre, p. ej. Rubén Sandoval`}
                        value={draft.emergencyContactName}
                        onChange={(event) => {
                          update('emergencyContactName')(event.target.value)
                        }}
                      />
                      <div className="flex gap-3">
                        <PhoneInput
                          value={draft.emergencyContactPhone}
                          onChange={(value) => {
                            update('emergencyContactPhone')(value)
                          }}
                          ariaLabel={t`Teléfono del contacto de emergencia`}
                          placeholder="404 790 2517"
                        />
                        <Select
                          value={
                            draft.emergencyContactRelationship === ''
                              ? UNSET
                              : draft.emergencyContactRelationship
                          }
                          onValueChange={(value) => {
                            update('emergencyContactRelationship')(value === UNSET ? '' : value)
                          }}
                        >
                          <SelectTrigger aria-label={t`Parentesco`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNSET}>
                              <Trans>Parentesco…</Trans>
                            </SelectItem>
                            {RELATIONSHIPS.map((relationship) => (
                              <SelectItem key={relationship} value={relationship}>
                                {RELATIONSHIP_LABEL[relationship]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </FormRow>

                  {aftermathDetails}
                </>
              )}

              {errorBanner}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
              {missingHint !== null ? (
                <span className="flex items-center gap-1.5 rounded-full bg-o-50 px-3 py-1.5 text-xs font-medium text-o-700">
                  <MaterialIcon name="info" className="text-sm" aria-hidden />
                  {missingHint}
                </span>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
                  <Trans>Cancelar</Trans>
                </Button>
                {step > 1 && (
                  <Button
                    type="button"
                    onClick={() => {
                      setStep(step - 1)
                    }}
                  >
                    <Trans>Atrás</Trans>
                  </Button>
                )}
                {/* Al editar se guarda desde cualquier paso: quien viene a corregir
                    un dato del paso 1 no tiene por qué recorrer los tres. Al dar de
                    alta, el primario sigue siendo avanzar hasta el final. */}
                {step < 3 && (
                  <Button
                    variant={isEditing ? 'secondary' : 'primary'}
                    type="button"
                    disabled={step === 1 && !canLeaveStep1}
                    onClick={goNext}
                  >
                    <Trans>Continuar</Trans>
                  </Button>
                )}
                {(isEditing || step === 3) && (
                  <Button
                    variant="primary"
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => {
                      void submit()
                    }}
                  >
                    {isLoading
                      ? t`Guardando…`
                      : isEditing
                        ? t`Guardar cambios`
                        : t`Crear colaborador`}
                  </Button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}
    </Modal>
  )
}

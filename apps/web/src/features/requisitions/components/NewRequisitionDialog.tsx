import { zodResolver } from '@hookform/resolvers/zod'
import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  toast,
} from '@oranje/ui'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useFieldArray, useForm, type FieldErrors } from 'react-hook-form'

import {
  useCreateRequisitionMutation,
  useGetOwnHotelOptionQuery,
  useGetPositionsForDepartmentQuery,
  useGetRequisitionFormOptionsQuery,
} from '../api/requisitionsApi'
import {
  buildRequisitionFormSchema,
  emptyPositionDraft,
  type RequisitionForm,
  type RequisitionPositionDraft,
} from '../types/requisitionForm.schema'

import { useGetSessionQuery } from '@/app/sessionApi'
import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajeUrgente from '@/assets/ilustrations/personaje-urgente.svg'
import { Button } from '@/shared/components/Button'
import { DateField } from '@/shared/components/DateField'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { StepIndicator } from '@/shared/components/StepIndicator'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'new-requisition'

/** Nombre humano de cada campo que `CATALOG_NOT_FOUND` puede señalar — el
    backend manda el nombre interno de la columna (`catalogPositionId`…). */
const CATALOG_FIELD_LABEL: Record<string, MessageDescriptor> = {
  catalogPositionId: msg`la posición`,
  hiringModalityId: msg`la modalidad`,
  hotelDepartmentId: msg`el departamento`,
  englishLevelId: msg`el nivel de inglés`,
}

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeContratacion,
    title: msg`Pide personal para tu hotel`,
    text: msg`La requisición es el pedido formal de colaboradores: qué posiciones necesitas y cuántas personas en cada una.`,
  },
  {
    image: personajeCronograma,
    title: msg`Cada posición con fecha y hora`,
    text: msg`Define cuántos, desde cuándo y en qué horario. Cada unidad de cantidad es un lugar que Reclutamiento va a cubrir.`,
  },
  {
    image: personajeUrgente,
    title: msg`Nace por autorizar`,
    text: msg`El folio se asigna al guardar y la urgencia corre desde que un Manager la autoriza — no la dejes en borrador.`,
  },
]

const WIZARD_STEPS: readonly { step: number; label: MessageDescriptor }[] = [
  { step: 1, label: msg`El hotel` },
  { step: 2, label: msg`Las posiciones` },
  { step: 3, label: msg`Revisión` },
]

const NO_ENGLISH = 'NONE'

function positionPath<K extends keyof RequisitionPositionDraft>(
  index: number,
  key: K,
): `positions.${number}.${K}` {
  return `positions.${String(index)}.${key}` as `positions.${number}.${K}`
}

const POSITION_FIELDS = [
  'catalogPositionId',
  'hiringModalityId',
  'quantity',
  'hotelDepartmentId',
  'startDate',
  'startTime',
] as const

function firstRowError(errors: FieldErrors<RequisitionForm>, index: number): string | undefined {
  const row = errors.positions?.[index]
  if (!row) return undefined

  for (const field of POSITION_FIELDS) {
    const message = row[field]?.message
    if (typeof message === 'string') return message
  }

  return undefined
}

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function createRequisitionErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      DEPARTMENT_OUT_OF_SCOPE: i18n._(
        msg`Solo puedes pedir posiciones de tu departamento. Las de otro departamento las crea su Manager de Área o el Manager General.`,
      ),
      HOTEL_OUT_OF_SCOPE: i18n._(msg`Solo puedes crear requisiciones de tu hotel.`),
      FORBIDDEN: i18n._(
        msg`Tu rol no puede crear requisiciones: las crean el Supervisor, el Manager de Área o el Manager General del hotel.`,
      ),
      /* El mensaje crudo del backend dice «apunta a un catalogPositionId que no
         existe» — el nombre de columna se coló porque nadie más lo traduce. */
      CATALOG_NOT_FOUND: (info) => {
        const detail = info.details[0]
        const fieldLabel =
          detail?.field !== undefined ? CATALOG_FIELD_LABEL[detail.field] : undefined
        const line =
          typeof detail?.value === 'string' || typeof detail?.value === 'number'
            ? String(detail.value)
            : '?'
        return fieldLabel
          ? i18n._(
              msg`El renglón ${line} elige un valor que ya no existe en el catálogo (${i18n._(fieldLabel)}): vuelve a elegirlo.`,
            )
          : i18n._(msg`El renglón ${line} apunta a un valor que ya no existe en el catálogo.`)
      },
    },
    fallback: i18n._(
      msg`No se pudo guardar la requisición. Revisa las posiciones e inténtalo de nuevo.`,
    ),
  })
}

export function NewRequisitionDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const { data: options } = useGetRequisitionFormOptionsQuery(undefined, { skip: !isOpen })
  const [createRequisition, { isLoading }] = useCreateRequisitionMutation()

  /* Los mensajes del esquema se resuelven al armarlo, así que se rearma al
     cambiar de idioma: `i18n` no cambia de identidad al activar otro (D-36). */
  const schema = useMemo(() => buildRequisitionFormSchema(i18n), [i18n, i18n.locale])

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors },
  } = useForm<RequisitionForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      hotelId: '',
      department: '',
      positions: [emptyPositionDraft('')],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'positions' })

  const { data: session } = useGetSessionQuery()
  const sessionHotel = session?.hotel ?? null
  /* El Supervisor y el Manager de Área solo piden posiciones de SU departamento
     (D-09): se fija y no se ofrece otro. Antes se ofrecían los cinco, el API
     respondía «solo tu departamento» y el diálogo lo traducía como «tu rol no
     puede crear». El Manager General no tiene departamento: elige. */
  const sessionDepartment = session?.department ?? null

  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('new-requisition')
  const [step, setStep] = useState(1)
  const [isReviewArmed, setIsReviewArmed] = useState(false)

  useEffect(() => {
    if (step !== 3) {
      setIsReviewArmed(false)
      return
    }
    const timer = window.setTimeout(() => {
      setIsReviewArmed(true)
    }, 350)
    return () => {
      window.clearTimeout(timer)
    }
  }, [step])

  async function goNext(): Promise<void> {
    if (step === 2) syncDepartmentIntoPositions()
    const isStepValid = await trigger(step === 1 ? ['hotelId', 'department'] : ['positions'])
    if (isStepValid && step < 3) setStep(step + 1)
  }

  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    /* Las filas nacen ya con el departamento fijado por la sesión: al reabrir
       el diálogo, `department` no cambia de valor y el efecto que lo baja a las
       posiciones no vuelve a correr — el segundo pedido del día del Supervisor
       llegaba al paso 2 con «Falta el departamento» sin campo que corregir. */
    const department = sessionDepartment?.id ?? ''
    reset({
      hotelId: sessionHotel?.id ?? '',
      department,
      positions: [emptyPositionDraft(department)],
    })
  }, [isOpen, reset, sessionHotel, sessionDepartment])

  const hotelId = watch('hotelId')
  const department = watch('department')
  const positions = watch('positions')

  const { data: ownHotel } = useGetOwnHotelOptionQuery(sessionHotel?.id ?? '', {
    skip: !isOpen || !sessionHotel,
  })
  const hotel = sessionHotel
    ? (ownHotel ?? null)
    : (options?.hotels.find((item) => item.id === hotelId) ?? null)

  const [isPhotoBroken, setIsPhotoBroken] = useState(false)
  useEffect(() => {
    setIsPhotoBroken(false)
  }, [hotel?.photoUrl])
  const heroPhoto = !isPhotoBroken && hotel?.photoUrl ? hotel.photoUrl : null

  /* El departamento se pregunta UNA vez (paso 1) y baja a todas las
     posiciones: preguntarlo de nuevo por fila era el mismo dato dos veces. */
  const syncDepartmentIntoPositions = useCallback((): void => {
    if (!department) return
    getValues('positions').forEach((position, index) => {
      if (position.hotelDepartmentId !== department) {
        setValue(positionPath(index, 'hotelDepartmentId'), department)
      }
    })
  }, [department, getValues, setValue])

  useEffect(() => {
    syncDepartmentIntoPositions()
  }, [syncDepartmentIntoPositions])

  /* Las posiciones se acotan al departamento elegido (el catálogo del vault
     agrupa por departamento): Housekeeping ofrece Housekeeper, no Chef. */
  const { data: departmentPositions } = useGetPositionsForDepartmentQuery(department, {
    skip: !isOpen || department === '',
  })

  /* Si el departamento cambia, una posición del anterior deja de ser válida:
     se limpia para que el select no enseñe un puesto que ya no está. */
  useEffect(() => {
    if (departmentPositions === undefined) return
    const valid = new Set(departmentPositions.map((item) => item.id))
    getValues('positions').forEach((position, index) => {
      if (position.catalogPositionId !== '' && !valid.has(position.catalogPositionId)) {
        setValue(positionPath(index, 'catalogPositionId'), '')
      }
    })
  }, [departmentPositions, getValues, setValue])

  const totalSlots = positions.reduce(
    (total, position) => total + (Number(position.quantity) || 0),
    0,
  )
  const positionCount = fields.length

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createRequisition({
        hotelId: values.hotelId,
        positions: values.positions.map((position) => ({
          catalogPositionId: position.catalogPositionId,
          hiringModalityId: position.hiringModalityId,
          hotelDepartmentId: values.department,
          ...(position.englishLevelId ? { englishLevelId: position.englishLevelId } : {}),
          quantity: Number(position.quantity),
          startDate: position.startDate,
          startTime: position.startTime,
        })),
      }).unwrap()
      onClose()
      /*
       * El momento donde nace la confusión: crear NO es terminar. La
       * requisición queda en Borrador y Reclutamiento no la ve hasta que un
       * Manager la autoriza — se dice aquí, cuando acaba de pasar, no solo
       * en el onboarding que se ve una vez.
       */
      toast.success(t`Requisición creada — quedó en Borrador`, {
        description: t`Reclutamiento la verá cuando un Manager la autorice. Sin la firma, para ellos no existe.`,
        duration: 8000,
        action: {
          label: t`Ir a autorizar`,
          onClick: () => {
            window.location.assign('/requisiciones/autorizacion')
          },
        },
      })
    } catch (error) {
      setError('root', {
        message: createRequisitionErrorMessage(error, i18n),
      })
    }
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Nueva requisición`}
      chromeless
      className="max-w-5xl"
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Comenzar la requisición`}
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="grid max-h-[calc(100vh-3rem)] grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
          {}
          <aside className="relative hidden overflow-hidden md:block">
            {heroPhoto ? (
              <>
                <img
                  src={heroPhoto}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  onError={() => {
                    setIsPhotoBroken(true)
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5"
                />
              </>
            ) : (
              <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-o-50 to-surface-3">
                <img
                  src={personajeContratacion}
                  alt=""
                  className="absolute top-8 left-1/2 h-44 w-auto -translate-x-1/2 opacity-90"
                />
              </div>
            )}

            <div
              className={cn(
                'relative flex h-full flex-col justify-end gap-2.5 p-6',
                heroPhoto ? 'text-surface' : 'text-ink',
              )}
            >
              <p className="text-2xl leading-tight font-bold">{hotel?.name ?? t`Elige el hotel`}</p>
              <p className={cn('text-sm', heroPhoto ? 'text-surface/85' : 'text-ink-2')}>
                {hotel
                  ? t`Zona ${hotel.zoneName} · el Inspector se congela al guardar`
                  : t`El Inspector se asigna solo por la zona del hotel`}
                {IS_DEV_UI && <code className="ml-1.5 text-[11px] opacity-60">RR-13</code>}
              </p>
              <p className="text-sm font-semibold">
                <Trans>
                  <Plural value={positionCount} one="# posición" other="# posiciones" /> ·{' '}
                  <Plural value={totalSlots} one="# slot" other="# slots" />
                </Trans>
              </p>
            </div>
          </aside>

          {}
          <section className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col">
            <header className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-ink">
                <Trans>Nueva requisición</Trans>
              </h2>
              {}
              <p className="mt-1 text-sm text-ink-3">
                <Trans>El folio se asigna automáticamente al guardar</Trans>
                {IS_DEV_UI && (
                  <code className="ml-1.5 text-[11px] text-ink-4">AAAAMMDDHHMM + homoclave</code>
                )}
              </p>
              <div className="mt-3">
                <StepIndicator
                  steps={WIZARD_STEPS.map((item) => ({
                    step: item.step,
                    label: i18n._(item.label),
                  }))}
                  current={step}
                  onStepClick={setStep}
                />
              </div>
            </header>

            <form
              id={FORM_ID}
              onSubmit={(event) => {
                if (step < 3) {
                  event.preventDefault()
                  void goNext()
                  return
                }
                void onSubmit(event)
              }}
              className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5"
            >
              {step === 1 && (
                <div className="flex max-w-md flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="req-hotel" className="text-sm font-medium text-ink-2">
                      <Trans>Hotel</Trans>
                    </label>
                    {sessionHotel ? (
                      <Input
                        value={sessionHotel.name}
                        readOnly
                        aria-label={t`Hotel`}
                        title={t`Solo puedes crear requisiciones de tu hotel`}
                        className="cursor-not-allowed bg-surface-2"
                      />
                    ) : (
                      <Controller
                        control={control}
                        name="hotelId"
                        render={({ field }) => (
                          <Select
                            {...(field.value ? { value: field.value } : {})}
                            onValueChange={field.onChange}
                            disabled={options !== undefined && options.hotels.length === 0}
                          >
                            <SelectTrigger id="req-hotel" aria-label={t`Hotel`} className="w-full">
                              <SelectValue
                                placeholder={
                                  options !== undefined && options.hotels.length === 0
                                    ? t`Aún no hay clientes activos`
                                    : t`Elige el hotel`
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(options?.hotels ?? []).map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    )}
                    {!sessionHotel && options !== undefined && options.hotels.length === 0 && (
                      <span className="text-xs text-ink-3">
                        <Trans>
                          Un hotel puede pedir personal cuando llega a Naranja, es decir, cuando ya
                          es cliente activo.
                        </Trans>
                      </span>
                    )}
                    {errors.hotelId && (
                      <span className="text-xs text-red">{errors.hotelId.message}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="req-department" className="text-sm font-medium text-ink-2">
                      <Trans>Departamento del hotel</Trans>
                    </label>
                    {sessionDepartment ? (
                      <Input
                        id="req-department"
                        value={sessionDepartment.name}
                        readOnly
                        aria-label={t`Departamento del hotel`}
                        title={t`Solo puedes pedir posiciones de tu departamento`}
                        className="cursor-not-allowed bg-surface-2"
                      />
                    ) : (
                      <Controller
                        control={control}
                        name="department"
                        render={({ field }) => (
                          <Select
                            {...(field.value ? { value: field.value } : {})}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="req-department"
                              aria-label={t`Departamento del hotel`}
                              className="w-full"
                            >
                              <SelectValue placeholder={t`Elige el departamento`} />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Un departamento sin posiciones en el catálogo no puede pedir
                                personal: se ve, con el porqué, pero no se elige — así nadie
                                descubre el hueco un paso después. */}
                              {(options?.departments ?? []).map((item) => {
                                const hasPositions = (options?.positions ?? []).some(
                                  (position) => position.hotelDepartmentId === item.id,
                                )
                                return (
                                  <SelectItem
                                    key={item.id}
                                    value={item.id}
                                    disabled={!hasPositions}
                                  >
                                    {item.name}
                                    {!hasPositions && ` · ${t`sin posiciones en el catálogo`}`}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    )}
                    {sessionDepartment && (
                      <span className="text-xs text-ink-3">
                        <Trans>
                          Las requisiciones de otro departamento las crea su Manager de Área o el
                          Manager General.
                        </Trans>
                      </span>
                    )}
                    {/* Sin esto el paso «no avanzaba» en silencio: la
                        validación corría pero su queja no se pintaba. */}
                    {errors.department && (
                      <span className="text-xs text-red">{errors.department.message}</span>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <fieldset>
                  <legend className="text-base font-semibold text-ink">
                    <Trans>Posiciones solicitadas</Trans>
                  </legend>
                  <p className="mt-1 text-sm text-ink-3">
                    {IS_DEV_UI
                      ? 'Cada unidad de Cantidad genera un slot: la fila que se bloquea al ocupar (D-02, RR-15)'
                      : t`Cada unidad de Cantidad es un lugar por cubrir`}
                  </p>

                  {departmentPositions !== undefined && departmentPositions.length === 0 && (
                    <p className="mt-3 rounded-md bg-yellow/15 px-3 py-2.5 text-sm text-ink-2">
                      <Trans>
                        Este departamento todavía no tiene posiciones en el catálogo — por eso el
                        selector de abajo no muestra nada. Pídele al Administrador que las agregue
                        en Catálogos antes de pedir personal aquí.
                      </Trans>
                      {IS_DEV_UI && (
                        <code className="block text-xs text-ink-4">
                          catalogs.position sin filas para este hotel_department_id
                        </code>
                      )}
                    </p>
                  )}

                  <div className="mt-4 flex flex-col gap-4">
                    {fields.map((field, index) => {
                      const quantity = Number(positions[index]?.quantity ?? 0) || 0
                      const rowError = firstRowError(errors, index)
                      const ordinal = index + 1

                      return (
                        <div
                          key={field.id}
                          className={cn(
                            'rounded-lg border border-line p-4',
                            rowError && 'border-red',
                          )}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">
                              <Trans>Posición {ordinal}</Trans>
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-o-50 px-2.5 py-1 text-sm font-medium whitespace-nowrap text-o-700">
                                <span
                                  className="material-icons-outlined text-base leading-none"
                                  aria-hidden
                                >
                                  layers
                                </span>
                                <Plural
                                  value={quantity}
                                  one="# slot libre"
                                  other="# slots libres"
                                />
                              </span>
                              <button
                                type="button"
                                disabled={fields.length === 1}
                                onClick={() => {
                                  remove(index)
                                }}
                                aria-label={t`Quitar posición ${ordinal}`}
                                title={t`Quitar esta posición del pedido`}
                                className="cursor-pointer rounded-md px-2 py-1 text-ink-3 transition-colors hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {/* Basurero y no ✕: esto ELIMINA la posición,
                                    no cierra nada. */}
                                <span
                                  className="material-icons-outlined text-lg leading-none"
                                  aria-hidden
                                >
                                  delete
                                </span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">
                                <Trans>Posición</Trans>
                              </span>
                              <Controller
                                control={control}
                                name={positionPath(index, 'catalogPositionId')}
                                render={({ field: f }) => (
                                  <Select
                                    {...(f.value ? { value: f.value } : {})}
                                    onValueChange={f.onChange}
                                    disabled={departmentPositions?.length === 0}
                                  >
                                    <SelectTrigger
                                      aria-label={t`Posición ${ordinal}`}
                                      className="w-full font-semibold"
                                    >
                                      <SelectValue
                                        placeholder={
                                          departmentPositions?.length === 0
                                            ? t`Sin posiciones para este departamento`
                                            : t`Elige la posición`
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(departmentPositions ?? []).map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </label>

                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">
                                <Trans>Modalidad</Trans>
                              </span>
                              <Controller
                                control={control}
                                name={positionPath(index, 'hiringModalityId')}
                                render={({ field: f }) => (
                                  <Select
                                    {...(f.value ? { value: f.value } : {})}
                                    onValueChange={f.onChange}
                                  >
                                    <SelectTrigger
                                      aria-label={t`Modalidad ${ordinal}`}
                                      className="w-full"
                                    >
                                      <SelectValue placeholder={t`Elige la modalidad`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(options?.modalities ?? []).map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </label>

                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">
                                <Trans>Inglés</Trans>
                              </span>
                              <Controller
                                control={control}
                                name={positionPath(index, 'englishLevelId')}
                                render={({ field: f }) => (
                                  <Select
                                    value={f.value === '' ? NO_ENGLISH : f.value}
                                    onValueChange={(value) => {
                                      f.onChange(value === NO_ENGLISH ? '' : value)
                                    }}
                                  >
                                    <SelectTrigger
                                      aria-label={t`Inglés ${ordinal}`}
                                      className="w-full"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NO_ENGLISH}>
                                        <Trans>No requerido</Trans>
                                      </SelectItem>
                                      {(options?.englishLevels ?? []).map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </label>

                            {/* El Departamento NO se repite aquí: se eligió en
                                el paso 1 y baja solo a cada posición. */}
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">
                                <Trans>Cantidad</Trans>
                              </span>
                              <Input
                                {...register(positionPath(index, 'quantity'))}
                                inputMode="numeric"
                                aria-label={t`Cantidad ${ordinal}`}
                              />
                            </label>

                            {/* Inicio y Hora como celdas propias de la rejilla:
                                partidos en media celda la fecha se truncaba
                                («17/09/20…») con el icono encimado. */}
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">
                                <Trans>Inicio</Trans>
                              </span>
                              {/* `[color-scheme:light]` + tinta plena: sin esto
                                  el date/time nativo sale desvaído y casi no
                                  se lee sobre el fondo crema. */}
                              <Controller
                                control={control}
                                name={positionPath(index, 'startDate')}
                                render={({ field, fieldState }) => (
                                  <DateField
                                    value={field.value}
                                    onChange={field.onChange}
                                    aria-label={t`Inicio ${ordinal}`}
                                    aria-invalid={fieldState.invalid}
                                  />
                                )}
                              />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">
                                <Trans>Hora</Trans>
                              </span>
                              <Input
                                type="time"
                                {...register(positionPath(index, 'startTime'))}
                                aria-label={t`Hora ${ordinal}`}
                                className="w-full min-w-0 text-ink [color-scheme:light]"
                              />
                            </label>
                          </div>

                          {rowError !== undefined && (
                            <p className="mt-2 text-sm text-red">{rowError}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {errors.positions?.root?.message !== undefined && (
                    <p className="mt-2 text-sm text-red">{errors.positions.root.message}</p>
                  )}
                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        append(emptyPositionDraft(department))
                      }}
                    >
                      <Trans>Agregar otra posición</Trans>
                    </Button>
                  </div>
                </fieldset>
              )}

              {step === 3 && (
                <div className="flex max-w-xl flex-col gap-4">
                  <div className="rounded-lg border border-line p-4">
                    <p className="text-xs font-semibold text-ink-3 uppercase">
                      <Trans>Hotel</Trans>
                    </p>
                    <p className="mt-1 text-base font-bold text-ink">
                      {hotel?.name ?? sessionHotel?.name ?? '—'}
                    </p>
                    {department !== '' && (
                      <p className="text-sm text-ink-2">
                        {options?.departments.find((item) => item.id === department)?.name ??
                          department}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-line p-4">
                    <p className="text-xs font-semibold text-ink-3 uppercase">
                      <Trans>Posiciones</Trans>
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {positions.map((position, index) => {
                        const label = (departmentPositions ?? options?.positions ?? []).find(
                          (item) => item.id === position.catalogPositionId,
                        )?.name
                        const ordinal = index + 1
                        const slots = Number(position.quantity) || 0
                        const startDate = position.startDate || '—'
                        return (
                          <li
                            key={fields[index]?.id ?? index}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="font-semibold text-ink">
                              {label ?? t`Posición ${ordinal}`}
                            </span>
                            <span className="text-ink-2">
                              <Trans>
                                <Plural value={slots} one="# slot" other="# slots" /> · desde{' '}
                                {startDate} · {position.startTime}
                              </Trans>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="mt-3 border-t border-line pt-3 text-sm font-semibold text-ink">
                      <Trans>
                        Total:{' '}
                        <Plural value={positionCount} one="# posición" other="# posiciones" /> ·{' '}
                        <Plural value={totalSlots} one="# slot" other="# slots" />
                      </Trans>
                    </p>
                  </div>
                  <p className="rounded-xl bg-o-50 px-4 py-3 text-xs leading-relaxed text-o-700">
                    <Trans>
                      Nace en Borrador: para que Reclutamiento la vea, un Manager debe autorizarla —
                      la urgencia corre desde ese momento.
                    </Trans>
                  </p>
                </div>
              )}

              {errors.root?.message !== undefined && (
                <p className="text-sm text-red">{errors.root.message}</p>
              )}
            </form>

            {}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
              <p className="text-sm font-semibold text-ink">
                <Trans>
                  Total: <Plural value={positionCount} one="# posición" other="# posiciones" /> ·{' '}
                  <Plural value={totalSlots} one="# slot" other="# slots" />
                </Trans>
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" type="button" onClick={onClose}>
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
                {step < 3 ? (
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => {
                      void goNext()
                    }}
                  >
                    <Trans>Continuar</Trans>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    type="submit"
                    form={FORM_ID}
                    disabled={isLoading || !isReviewArmed}
                  >
                    {isLoading ? t`Guardando…` : t`Guardar requisición`}
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

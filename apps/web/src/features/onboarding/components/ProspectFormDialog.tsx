import { zodResolver } from '@hookform/resolvers/zod'
import { Input, cn } from '@oranje/ui'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import {
  useCreateProspectMutation,
  useGetRegisteredHotelsQuery,
  useGetZonesQuery,
  useUpdateProspectMutation,
} from '../api/onboardingApi'
import type { ProspectDetail } from '../types/prospect.types'
import {
  GEOFENCE_MAX_M,
  GEOFENCE_MIN_M,
  GEOFENCE_STEP_M,
  prospectFormSchema,
  type ProspectFormValues,
} from '../types/prospectForm.schema'

import { HotelLocationMap } from './HotelLocationMap'
import { PlacesAutofillSummary } from './PlacesAutofillSummary'
import { PlacesSearchField, type PlaceAutofill } from './PlacesSearchField'

import { useGetSessionQuery } from '@/app/sessionApi'
import { Button } from '@/shared/components/Button'
import { MapsScope } from '@/shared/components/MapsScope'
import { Modal } from '@/shared/components/Modal'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'prospect-form'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2'

/** Zonas horarias de operación. Identificadores IANA, no catálogo de negocio. */
const TIME_ZONES = [
  'America/Cancun',
  'America/Merida',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Mazatlan',
  'America/Tijuana',
] as const

/**
 * Campo del modal: etiqueta, marca de obligatorio, control y —debajo— el nombre
 * de la columna. Las anotaciones de esquema (NOT NULL, columna) solo se pintan
 * en dev local (IS_DEV_UI): son documentación para construir contra la base,
 * no producto.
 */
function Field({
  label,
  htmlFor,
  isRequired = false,
  note,
  column,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  isRequired?: boolean
  note?: string
  column?: string
  error?: string | undefined
  children: ReactNode
}): ReactNode {
  const labelClass = 'text-sm font-semibold text-ink'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        {htmlFor === undefined ? (
          <span className={labelClass}>{label}</span>
        ) : (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        )}
        {IS_DEV_UI && isRequired && (
          <span className="text-xs font-semibold text-red">NOT NULL</span>
        )}
        {note && <span className="text-xs text-ink-3">{note}</span>}
      </div>

      {children}

      {error !== undefined ? (
        <p className="text-xs text-red">{error}</p>
      ) : (
        IS_DEV_UI && column && <p className="text-xs text-ink-4">{column}</p>
      )}
    </div>
  )
}

/**
 * Del error de la API a una frase que diga QUÉ corregir. El fallback genérico
 * queda solo para lo que de verdad no se sabe: un «revisa los datos» ante un
 * 409 de ciclo abierto mandaba a revisar campos que estaban bien.
 */
function saveErrorMessage(error: unknown): string {
  const data = (
    error as
      { data?: { error?: { code?: string; message?: string }; message?: string } } | undefined
  )?.data
  const code = data?.error?.code

  if (code === 'PROSPECT_ALREADY_OPEN') {
    return 'Este hotel ya tiene un ciclo comercial abierto: ciérralo o elige otro hotel.'
  }
  if (code === 'HOTEL_NAME_TAKEN') return 'Ya existe un hotel con ese nombre.'
  if (data?.error?.message) return data.error.message
  if (typeof data?.message === 'string') return data.message
  return 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.'
}

/** El sufijo de esquema (`· commercial.hotel`) solo se pinta en dev local. */
function SectionTitle({ children, schema }: { children: ReactNode; schema?: string }): ReactNode {
  return (
    <h3 className="text-sm font-semibold text-ink">
      {children}
      {IS_DEV_UI && schema && <span className="font-normal text-ink-4"> · {schema}</span>}
    </h3>
  )
}

type WizardStep = 1 | 2 | 3 | 4

const WIZARD_STEPS: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: 'El edificio' },
  { step: 2, label: 'Ubicación' },
  { step: 3, label: 'Primer contacto' },
  { step: 4, label: 'El ciclo' },
]

/** Qué campos valida «Continuar» en cada paso. */
const STEP_FIELDS: Record<WizardStep, Array<keyof ProspectFormValues>> = {
  1: ['hotelSource', 'existingHotelId', 'hotelName', 'zoneId', 'timeZone'],
  2: ['location', 'geofenceMeters'],
  3: ['contactFullName', 'contactEmail'],
  4: ['ownerUserId'],
}

/** Indicador del wizard. Los pasos ya recorridos son clicables para volver. */
function StepIndicator({
  current,
  onStepClick,
}: {
  current: WizardStep
  onStepClick: (step: WizardStep) => void
}): ReactNode {
  return (
    <ol className="flex items-center gap-2">
      {WIZARD_STEPS.map(({ step, label }, index) => {
        const isDone = step < current
        const isActive = step === current
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-line sm:w-10" aria-hidden />}
            <button
              type="button"
              disabled={!isDone}
              onClick={() => {
                onStepClick(step)
              }}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition-colors',
                isDone && 'cursor-pointer hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  isActive && 'bg-o-500 text-ink',
                  isDone && 'bg-green text-white',
                  !isActive && !isDone && 'border border-line text-ink-3',
                )}
              >
                {isDone ? (
                  <span className="material-icons-outlined text-sm leading-none" aria-hidden>
                    check
                  </span>
                ) : (
                  step
                )}
              </span>
              <span className={cn(isActive ? 'font-semibold text-ink' : 'text-ink-3')}>
                {label}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export interface ProspectFormDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Sin prospecto se abre en alta; con él, en edición. */
  prospect?: ProspectDetail
  onCreated?: (prospect: ProspectDetail) => void
}

/**
 * Alta y edición de un prospecto, en un solo modal.
 *
 * Cubre las tres tablas a la vez porque abrir un ciclo son tres inserciones que
 * no tienen sentido por separado: el edificio (`commercial.hotel`), su primer
 * contacto (`commercial.hotel_contact`) y el ciclo (`commercial.prospect`).
 *
 * El mismo componente edita: cambia el título, oculta el selector de origen del
 * hotel —un ciclo abierto no cambia de edificio— y manda PATCH en vez de POST.
 */
export function ProspectFormDialog({
  isOpen,
  onClose,
  prospect,
  onCreated,
}: ProspectFormDialogProps): ReactNode {
  const isEditing = prospect !== undefined

  const { data: session } = useGetSessionQuery()
  const { data: zones = [] } = useGetZonesQuery()
  const { data: registeredHotels = [] } = useGetRegisteredHotelsQuery(undefined, {
    skip: isEditing,
  })

  const [createProspect, { isLoading: isCreating, isError: hasCreateFailed, error: createError }] =
    useCreateProspectMutation()
  const [updateProspect, { isLoading: isUpdating, isError: hasUpdateFailed, error: updateError }] =
    useUpdateProspectMutation()

  const primaryContact = prospect?.contacts.find((contact) => contact.isPrimary)

  const defaults: ProspectFormValues = {
    intent: isEditing ? 'EDIT' : 'CREATE',
    hotelSource: 'NEW',
    existingHotelId: '',
    hotelName: prospect?.hotelName ?? '',
    zoneId: prospect?.hotel.zoneId ?? '',
    timeZone: prospect?.hotel.timeZone ?? 'America/Cancun',
    address: prospect?.hotel.address ?? '',
    generalPhone: prospect?.hotel.generalPhone ?? '',
    location: prospect?.hotel.location ?? null,
    placeLocation: null,
    geofenceMeters: prospect?.hotel.geofenceMeters ?? 150,
    contactFullName: primaryContact?.name ?? '',
    contactJobTitle: primaryContact?.role ?? '',
    contactPhone: primaryContact?.phone ?? '',
    contactEmail: '',
    isPrimaryContact: true,
    ownerUserId: prospect?.owner.id ?? session?.id ?? '',
    needDescription: prospect?.needDescription ?? '',
  }

  const { register, handleSubmit, reset, setValue, watch, trigger, formState } =
    useForm<ProspectFormValues>({
      resolver: zodResolver(prospectFormSchema),
      mode: 'onChange',
      defaultValues: defaults,
    })

  /**
   * Al abrir se parte de los valores del prospecto, o de cero si es un alta.
   * `defaults` NO va en las dependencias: se recrea en cada render y reiniciaría
   * el formulario mientras se escribe. Lo que importa es qué prospecto se está
   * editando y cuándo se abre.
   */
  useEffect(() => {
    if (isOpen) {
      reset(defaults)
      setPlacePhotoUrl(prospect?.hotel.photoUrl ?? null)
      setStep(1)
    }
  }, [isOpen, prospect, session?.id, reset])

  const values = watch()
  const isBusy = isCreating || isUpdating
  /** Foto del lugar según Google, y también la ya persistida al editar. */
  const [placePhotoUrl, setPlacePhotoUrl] = useState<string | null>(null)

  /**
   * Wizard de 3 pasos. «Continuar» valida SOLO los campos del paso en turno:
   * así el error aparece junto a lo que se está llenando, no al final.
   */
  const [step, setStep] = useState<WizardStep>(1)

  async function goNext(): Promise<void> {
    const isStepValid = await trigger(STEP_FIELDS[step])
    if (isStepValid && step < 4) setStep((step + 1) as WizardStep)
  }
  const isExistingHotel = values.hotelSource === 'EXISTING'

  /**
   * Elegir un sitio autollena lo que Places sabe. La coordenada pasa a ser la
   * de Google, así que el pin deja de estar «movido a mano».
   */
  function applyPlace(place: PlaceAutofill): void {
    setValue('hotelName', place.name, { shouldValidate: true })
    setValue('address', place.address)
    if (place.phone) setValue('generalPhone', place.phone)
    setValue('location', place.location, { shouldValidate: true })
    setValue('placeLocation', place.location)
    setPlacePhotoUrl(place.photoUrl)
  }

  /** Arrastrar o clicar mueve la coordenada a mano: ya no es la de Google. */
  function movePin(point: { lat: number; lng: number }): void {
    setValue('location', point, { shouldValidate: true })
    setValue('placeLocation', null)
  }

  function applyRegisteredHotel(hotelId: string): void {
    const hotel = registeredHotels.find((item) => item.id === hotelId)
    if (!hotel) return

    setValue('hotelName', hotel.name, { shouldValidate: true })
    setValue('zoneId', hotel.zoneId, { shouldValidate: true })
    setValue('timeZone', hotel.timeZone)
    setValue('address', hotel.address)
    setValue('generalPhone', hotel.generalPhone)
    setValue('location', hotel.location, { shouldValidate: true })
    setValue('geofenceMeters', hotel.geofenceMeters)
  }

  async function onSubmit(form: ProspectFormValues): Promise<void> {
    if (!form.location) return

    const hotel = {
      name: form.hotelName,
      zoneId: form.zoneId,
      timeZone: form.timeZone,
      address: form.address,
      generalPhone: form.generalPhone,
      location: form.location,
      geofenceMeters: form.geofenceMeters,
      photoUrl: placePhotoUrl,
    }
    const contact = {
      fullName: form.contactFullName,
      jobTitle: form.contactJobTitle,
      phone: form.contactPhone,
      email: form.contactEmail,
      isPrimary: form.isPrimaryContact,
    }

    try {
      if (prospect) {
        await updateProspect({
          prospectId: prospect.id,
          hotel,
          ...(form.contactFullName ? { contact } : {}),
          ownerUserId: form.ownerUserId,
          needDescription: form.needDescription,
        }).unwrap()
      } else {
        const created = await createProspect({
          hotelSource: form.hotelSource,
          ...(form.existingHotelId ? { existingHotelId: form.existingHotelId } : {}),
          hotel,
          contact,
          ownerUserId: form.ownerUserId,
          needDescription: form.needDescription,
        }).unwrap()
        onCreated?.(created)
      }
      onClose()
    } catch {
      // Queda en `hasCreateFailed` / `hasUpdateFailed`; el modal no se cierra.
    }
  }

  const status: OnboardingStatus = prospect?.status ?? 'GRAY'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar prospecto' : 'Nuevo prospecto'}
      description={
        isEditing
          ? 'Corrige el edificio, su contacto principal y el ciclo. El semáforo no se toca aquí.'
          : 'Abre un ciclo comercial. El hotel es el edificio; el prospecto es el ciclo (D-13).'
      }
      className="max-w-[95rem] gap-4 p-6"
      footer={
        <>
          <Button onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          {step > 1 && (
            <Button
              onClick={() => {
                setStep((step - 1) as WizardStep)
              }}
              disabled={isBusy}
            >
              Atrás
            </Button>
          )}
          {step < 4 ? (
            <Button
              variant="primary"
              type="button"
              onClick={() => {
                void goNext()
              }}
            >
              Continuar
            </Button>
          ) : (
            <Button
              variant="primary"
              type="submit"
              form={FORM_ID}
              disabled={!formState.isValid || isBusy}
            >
              {isBusy ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear prospecto'}
            </Button>
          )}
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event)
        }}
        className="flex flex-col gap-4"
      >
        <StepIndicator
          current={step}
          onStepClick={(target) => {
            setStep(target)
          }}
        />

        {!isEditing && step === 1 && (
          <div className="flex w-fit gap-1 rounded-lg bg-surface-3/60 p-1">
            {(
              [
                ['NEW', 'Hotel nuevo'],
                ['EXISTING', 'Hotel ya registrado'],
              ] as const
            ).map(([source, label]) => (
              <button
                key={source}
                type="button"
                aria-pressed={values.hotelSource === source}
                onClick={() => {
                  setValue('hotelSource', source, { shouldValidate: true })
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  values.hotelSource === source
                    ? 'bg-surface font-semibold text-ink shadow-sm'
                    : 'text-ink-3 hover:text-ink-2',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <MapsScope>
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            {/* Izquierda: el paso en turno; la derecha acompaña siempre con el mapa */}
            <div className="flex min-h-105 flex-col gap-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="flex flex-col gap-4"
                >
                  {step === 1 && (
                    <>
                      <SectionTitle schema="commercial.hotel">El edificio</SectionTitle>

                      {isExistingHotel && (
                        <Field
                          label="Hotel registrado"
                          htmlFor="existingHotelId"
                          isRequired
                          column="hotel_id · solo hoteles sin ciclo abierto"
                          error={formState.errors.existingHotelId?.message}
                        >
                          <select
                            id="existingHotelId"
                            {...register('existingHotelId', {
                              onChange: (event: { target: { value: string } }) => {
                                applyRegisteredHotel(event.target.value)
                              },
                            })}
                            className={CONTROL_CLASS}
                          >
                            <option value="">
                              {registeredHotels.length === 0
                                ? 'No hay hoteles libres: todos tienen ciclo abierto'
                                : 'Elige un hotel…'}
                            </option>
                            {registeredHotels.map((hotel) => (
                              <option key={hotel.id} value={hotel.id}>
                                {hotel.name} · {hotel.zone}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}

                      <Field
                        label="Nombre del hotel"
                        htmlFor="hotelName"
                        isRequired
                        column="name"
                        error={formState.errors.hotelName?.message}
                      >
                        <Input
                          id="hotelName"
                          type="text"
                          placeholder="Hotel Puerto Real"
                          disabled={isExistingHotel}
                          {...register('hotelName')}
                        />
                      </Field>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field
                          label="Zona"
                          htmlFor="zoneId"
                          isRequired
                          column="zone_id + catalogs.zone"
                          error={formState.errors.zoneId?.message}
                        >
                          <select id="zoneId" {...register('zoneId')} className={CONTROL_CLASS}>
                            <option value="">Selecciona una zona</option>
                            {zones.map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.label}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field
                          label="Zona horaria"
                          htmlFor="timeZone"
                          isRequired
                          column="time_zone"
                          error={formState.errors.timeZone?.message}
                        >
                          <select id="timeZone" {...register('timeZone')} className={CONTROL_CLASS}>
                            {TIME_ZONES.map((zone) => (
                              <option key={zone} value={zone}>
                                {zone}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <SectionTitle>Ubicación</SectionTitle>

                      <Field
                        label="Buscar en Google"
                        isRequired
                        note="elige el hotel: pin, dirección y foto llegan solos"
                        column="latitude + longitude"
                        error={formState.errors.location?.message}
                      >
                        <PlacesSearchField defaultValue={values.address} onPick={applyPlace} />
                      </Field>

                      <Field
                        label="Radio de geocerca"
                        htmlFor="geofenceMeters"
                        column="geofence_radius_m · lo evalúa ST_DWithin en el servidor (D-08)"
                        error={formState.errors.geofenceMeters?.message}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            id="geofenceMeters"
                            type="range"
                            min={GEOFENCE_MIN_M}
                            max={GEOFENCE_MAX_M}
                            step={GEOFENCE_STEP_M}
                            {...register('geofenceMeters', { valueAsNumber: true })}
                            className="h-1.5 min-w-0 flex-1 accent-o-500"
                          />
                          <span className="w-14 shrink-0 text-right text-sm font-semibold text-ink">
                            {values.geofenceMeters} m
                          </span>
                        </div>
                      </Field>

                      {!placePhotoUrl && (
                        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-3">
                          Sin foto todavía: al elegir el hotel en el buscador, Google la trae y se
                          guarda con el hotel.
                        </p>
                      )}

                      <div className="rounded-md bg-o-50 p-4">
                        <p className="text-sm font-semibold text-o-700">
                          El pin se arrastra a propósito.
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-2">
                          Google devuelve el centro del lugar, que casi nunca es por donde entra el
                          colaborador. Arrástralo en el mapa a la entrada real: unos metros de más
                          rechazan ponches legítimos.
                        </p>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
                      <SectionTitle schema="commercial.hotel_contact">Primer contacto</SectionTitle>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field
                          label="Nombre"
                          htmlFor="contactFullName"
                          isRequired={!isEditing}
                          column="full_name"
                          error={formState.errors.contactFullName?.message}
                        >
                          <Input
                            id="contactFullName"
                            type="text"
                            placeholder="Marta Solís"
                            {...register('contactFullName')}
                          />
                        </Field>

                        <Field label="Puesto" htmlFor="contactJobTitle" column="job_title">
                          <Input
                            id="contactJobTitle"
                            type="text"
                            placeholder="Gerente de Compras"
                            {...register('contactJobTitle')}
                          />
                        </Field>

                        <Field label="Teléfono" htmlFor="contactPhone" column="phone">
                          <Input
                            id="contactPhone"
                            type="tel"
                            placeholder="+52 998 111 2233"
                            {...register('contactPhone')}
                          />
                        </Field>

                        <Field
                          label="Correo"
                          htmlFor="contactEmail"
                          column="email"
                          error={formState.errors.contactEmail?.message}
                        >
                          <Input
                            id="contactEmail"
                            type="email"
                            placeholder="marta.solis@puertoreal.mx"
                            {...register('contactEmail')}
                          />
                        </Field>
                      </div>

                      <label className="flex cursor-pointer items-center gap-3 rounded-md bg-o-50 px-3 py-2.5">
                        <input
                          type="checkbox"
                          {...register('isPrimaryContact')}
                          className="size-4 accent-o-500"
                        />
                        <span className="text-sm font-semibold text-ink">
                          Es el contacto principal
                        </span>
                        {IS_DEV_UI && <span className="text-xs text-ink-3">is_primary</span>}
                      </label>
                    </section>
                  )}

                  {step === 4 && (
                    <>
                      <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
                        <SectionTitle schema="commercial.prospect">El ciclo comercial</SectionTitle>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field
                            label="Dueño del prospecto"
                            htmlFor="ownerUserId"
                            isRequired
                            column="owner_user_id"
                            error={formState.errors.ownerUserId?.message}
                          >
                            {/*
                      ⚠ Un solo dueño posible: no existe endpoint de equipo
                      todavía, así que solo se ofrece quien tiene la sesión.
                    */}
                            <select
                              id="ownerUserId"
                              {...register('ownerUserId')}
                              className={CONTROL_CLASS}
                            >
                              {session && (
                                <option value={session.id}>
                                  {session.name} · {session.roleCode}
                                </option>
                              )}
                            </select>
                          </Field>

                          <Field
                            label="Qué necesita"
                            htmlFor="needDescription"
                            column="need_description"
                          >
                            <Input
                              id="needDescription"
                              type="text"
                              placeholder="2 camaristas y 1 houseman"
                              {...register('needDescription')}
                            />
                          </Field>
                        </div>

                        <Field
                          label={isEditing ? 'Estado actual' : 'Estado inicial'}
                          column="ck_prospect_light fija el semáforo a ONBOARDING · un solo ciclo abierto por hotel"
                        >
                          <div className="flex items-center gap-3">
                            <StatusLightSoftBadge
                              token={ONBOARDING_STATUS_TOKEN[status]}
                              label={ONBOARDING_STATUS_LABEL[status]}
                            />
                            <span className="text-sm text-ink-3">
                              {ONBOARDING_STATUS_DESCRIPTION[status]}
                            </span>
                          </div>
                        </Field>
                      </section>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Derecha: mapa y ficha SIEMPRE a la vista — es la vista previa del alta */}
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                {step === 2 && placePhotoUrl && (
                  /* Hero de Ubicación: la foto de Places se disuelve hacia el mapa. */
                  <div className="relative">
                    <img
                      src={placePhotoUrl}
                      alt={`Foto de ${values.hotelName || 'el hotel'} según Google`}
                      className="h-40 w-full object-cover"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-surface"
                    />
                    <p className="absolute bottom-2 left-4 text-base font-semibold text-ink">
                      {values.hotelName}
                    </p>
                  </div>
                )}
                <HotelLocationMap
                  value={values.location}
                  geofenceMeters={values.geofenceMeters}
                  onMovePin={movePin}
                  className={cn(
                    'rounded-none border-0',
                    // En el paso de Ubicación el mapa manda: grande y arrastrable.
                    step === 2 ? 'h-105' : 'h-40 border-b border-line',
                  )}
                />

                {step !== 2 && (
                  <PlacesAutofillSummary
                    photoUrl={placePhotoUrl}
                    hotelName={values.hotelName}
                    address={values.address}
                    generalPhone={values.generalPhone}
                    timeZone={values.timeZone}
                    location={values.location}
                    geofenceMeters={values.geofenceMeters}
                    status={status}
                    isPinMoved={
                      values.location !== null &&
                      (values.placeLocation === null ||
                        values.placeLocation.lat !== values.location.lat ||
                        values.placeLocation.lng !== values.location.lng)
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </MapsScope>

        {(hasCreateFailed || hasUpdateFailed) && (
          <p role="alert" className="rounded-md bg-red/10 p-4 text-sm text-red">
            {saveErrorMessage(hasCreateFailed ? createError : updateError)}
          </p>
        )}
      </form>
    </Modal>
  )
}

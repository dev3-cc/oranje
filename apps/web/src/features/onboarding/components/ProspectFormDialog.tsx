import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@oranje/ui'
import { useEffect, type ReactNode } from 'react'
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
 * de la columna. Ese pie no es decorativo: al capturar, dice exactamente qué se
 * está llenando de la base, que es lo que pide la maqueta.
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
        {isRequired && <span className="text-xs font-semibold text-red">NOT NULL</span>}
        {note && <span className="text-xs text-ink-3">{note}</span>}
      </div>

      {children}

      {error !== undefined ? (
        <p className="text-xs text-red">{error}</p>
      ) : (
        column && <p className="text-xs text-ink-4">{column}</p>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  return <h3 className="text-sm font-semibold text-ink">{children}</h3>
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

  const [createProspect, { isLoading: isCreating, isError: hasCreateFailed }] =
    useCreateProspectMutation()
  const [updateProspect, { isLoading: isUpdating, isError: hasUpdateFailed }] =
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

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<ProspectFormValues>(
    {
      resolver: zodResolver(prospectFormSchema),
      mode: 'onChange',
      defaultValues: defaults,
    },
  )

  /**
   * Al abrir se parte de los valores del prospecto, o de cero si es un alta.
   * `defaults` NO va en las dependencias: se recrea en cada render y reiniciaría
   * el formulario mientras se escribe. Lo que importa es qué prospecto se está
   * editando y cuándo se abre.
   */
  useEffect(() => {
    if (isOpen) reset(defaults)
  }, [isOpen, prospect, session?.id, reset])

  const values = watch()
  const isBusy = isCreating || isUpdating
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

  const status: OnboardingStatus = prospect?.status ?? 'GRIS'

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
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={!formState.isValid || isBusy}
          >
            {isBusy ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear prospecto'}
          </Button>
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
        {!isEditing && (
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
            {/* Izquierda: el edificio, su geocerca y el contacto con el que abre */}
            <div className="flex flex-col gap-4">
              <SectionTitle>El edificio · commercial.hotel</SectionTitle>

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
                <input
                  id="hotelName"
                  type="text"
                  placeholder="Hotel Puerto Real"
                  disabled={isExistingHotel}
                  {...register('hotelName')}
                  className={CONTROL_CLASS}
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

              <Field
                label="Ubicación"
                isRequired
                note="Places Autocomplete"
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

              <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
                <SectionTitle>Primer contacto · commercial.hotel_contact</SectionTitle>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Nombre"
                    htmlFor="contactFullName"
                    isRequired={!isEditing}
                    column="full_name"
                    error={formState.errors.contactFullName?.message}
                  >
                    <input
                      id="contactFullName"
                      type="text"
                      placeholder="Marta Solís"
                      {...register('contactFullName')}
                      className={CONTROL_CLASS}
                    />
                  </Field>

                  <Field label="Puesto" htmlFor="contactJobTitle" column="job_title">
                    <input
                      id="contactJobTitle"
                      type="text"
                      placeholder="Gerente de Compras"
                      {...register('contactJobTitle')}
                      className={CONTROL_CLASS}
                    />
                  </Field>

                  <Field label="Teléfono" htmlFor="contactPhone" column="phone">
                    <input
                      id="contactPhone"
                      type="tel"
                      placeholder="+52 998 111 2233"
                      {...register('contactPhone')}
                      className={CONTROL_CLASS}
                    />
                  </Field>

                  <Field
                    label="Correo"
                    htmlFor="contactEmail"
                    column="email"
                    error={formState.errors.contactEmail?.message}
                  >
                    <input
                      id="contactEmail"
                      type="email"
                      placeholder="marta.solis@puertoreal.mx"
                      {...register('contactEmail')}
                      className={CONTROL_CLASS}
                    />
                  </Field>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-md bg-o-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    {...register('isPrimaryContact')}
                    className="size-4 accent-o-500"
                  />
                  <span className="text-sm font-semibold text-ink">Es el contacto principal</span>
                  <span className="text-xs text-ink-3">is_primary</span>
                </label>
              </section>
            </div>

            {/* Derecha: mapa y ficha en UNA tarjeta, y debajo el ciclo comercial */}
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <HotelLocationMap
                  value={values.location}
                  geofenceMeters={values.geofenceMeters}
                  onMovePin={movePin}
                  className="h-40 rounded-none border-0 border-b border-line"
                />

                <PlacesAutofillSummary
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
              </div>

              <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
                <SectionTitle>El ciclo comercial · commercial.prospect</SectionTitle>

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
                    <select id="ownerUserId" {...register('ownerUserId')} className={CONTROL_CLASS}>
                      {session && (
                        <option value={session.id}>
                          {session.name} · {session.roleCode}
                        </option>
                      )}
                    </select>
                  </Field>

                  <Field label="Qué necesita" htmlFor="needDescription" column="need_description">
                    <input
                      id="needDescription"
                      type="text"
                      placeholder="2 camaristas y 1 houseman"
                      {...register('needDescription')}
                      className={CONTROL_CLASS}
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
            </div>

            {/* Cruza las dos columnas: explica el mapa y el radio a la vez */}
            <aside className="rounded-md bg-o-50 p-4 xl:col-span-2">
              <p className="text-sm font-semibold text-o-700">El pin se arrastra a propósito.</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Google devuelve el centroide del lugar, que casi nunca es por donde entra el
                colaborador. Como la geocerca se evalúa con ST_DWithin, unos metros de más rechazan
                ponches legítimos.
              </p>
            </aside>
          </div>
        </MapsScope>

        {(hasCreateFailed || hasUpdateFailed) && (
          <p className="rounded-md bg-red/10 p-4 text-sm text-red">
            No se pudo guardar. Revisa los datos e inténtalo de nuevo.
          </p>
        )}
      </form>
    </Modal>
  )
}

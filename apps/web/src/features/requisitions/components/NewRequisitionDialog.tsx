import { zodResolver } from '@hookform/resolvers/zod'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useFieldArray, useForm, type FieldErrors } from 'react-hook-form'

import {
  useCreateRequisitionMutation,
  useGetOwnHotelOptionQuery,
  useGetRequisitionFormOptionsQuery,
} from '../api/requisitionsApi'
import {
  emptyPositionDraft,
  requisitionFormSchema,
  type RequisitionForm,
  type RequisitionPositionDraft,
} from '../types/requisitionForm.schema'

import { useGetSessionQuery } from '@/app/sessionApi'
import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajeUrgente from '@/assets/ilustrations/personaje-urgente.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { StepIndicator } from '@/shared/components/StepIndicator'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'new-requisition'

const INTRO_SLIDES = [
  {
    image: personajeContratacion,
    title: 'Pide personal para tu hotel',
    text: 'La requisición es el pedido formal de colaboradores: qué posiciones necesitas y cuántas personas en cada una.',
  },
  {
    image: personajeCronograma,
    title: 'Cada posición con fecha y hora',
    text: 'Define cuántos, desde cuándo y en qué horario. Cada unidad de cantidad es un lugar que Reclutamiento va a cubrir.',
  },
  {
    image: personajeUrgente,
    title: 'Nace por autorizar',
    text: 'El folio se asigna al guardar y la urgencia corre desde que un Manager la autoriza — no la dejes en borrador.',
  },
] as const

const WIZARD_STEPS = [
  { step: 1, label: 'El hotel' },
  { step: 2, label: 'Las posiciones' },
  { step: 3, label: 'Revisión' },
] as const

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

export function NewRequisitionDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { data: options } = useGetRequisitionFormOptionsQuery(undefined, { skip: !isOpen })
  const [createRequisition, { isLoading }] = useCreateRequisitionMutation()

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
    resolver: zodResolver(requisitionFormSchema),
    defaultValues: {
      hotelId: '',
      department: '',
      positions: [emptyPositionDraft('')],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'positions' })

  const { data: session } = useGetSessionQuery()
  const sessionHotel = session?.hotel ?? null

  const [showIntro, setShowIntro] = useState(false)
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
    const isStepValid = await trigger(step === 1 ? ['hotelId', 'department'] : ['positions'])
    if (isStepValid && step < 3) setStep(step + 1)
  }

  useEffect(() => {
    if (!isOpen) return
    setShowIntro(true)
    setStep(1)
    reset({
      hotelId: sessionHotel?.id ?? '',
      department: '',
      positions: [emptyPositionDraft('')],
    })
  }, [isOpen, reset, sessionHotel])

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

  useEffect(() => {
    if (!department) return
    getValues('positions').forEach((position, index) => {
      if (!position.hotelDepartmentId) {
        setValue(positionPath(index, 'hotelDepartmentId'), department)
      }
    })
  }, [department, getValues, setValue])

  const totalSlots = positions.reduce(
    (total, position) => total + (Number(position.quantity) || 0),
    0,
  )

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createRequisition({
        hotelId: values.hotelId,
        positions: values.positions.map((position) => ({
          catalogPositionId: position.catalogPositionId,
          hiringModalityId: position.hiringModalityId,
          hotelDepartmentId: position.hotelDepartmentId,
          ...(position.englishLevelId ? { englishLevelId: position.englishLevelId } : {}),
          quantity: Number(position.quantity),
          startDate: position.startDate,
          startTime: position.startTime,
        })),
      }).unwrap()
      onClose()
    } catch (error) {
      setError('root', {
        message: apiErrorMessage(error, {
          byStatus: {
            403: 'Tu rol no puede crear requisiciones: las crean el Supervisor, el Manager de Área o el Manager General del hotel.',
          },
          fallback: 'No se pudo guardar la requisición.',
        }),
      })
    }
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva requisición"
      chromeless
      className="max-w-5xl"
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Comenzar la requisición"
          onDone={() => {
            setShowIntro(false)
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
              <p className="text-2xl leading-tight font-bold">{hotel?.name ?? 'Elige el hotel'}</p>
              <p className={cn('text-sm', heroPhoto ? 'text-surface/85' : 'text-ink-2')}>
                {hotel
                  ? `Zona ${hotel.zoneName} · el Inspector se congela al guardar`
                  : 'El Inspector se asigna solo por la zona del hotel'}
                {IS_DEV_UI && <code className="ml-1.5 text-[11px] opacity-60">RR-13</code>}
              </p>
              <p className="text-sm font-semibold">
                {fields.length} {fields.length === 1 ? 'posición' : 'posiciones'} · {totalSlots}{' '}
                {totalSlots === 1 ? 'slot' : 'slots'}
              </p>
            </div>
          </aside>

          {}
          <section className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col">
            <header className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-ink">Nueva requisición</h2>
              {}
              <p className="mt-1 text-sm text-ink-3">
                El folio se asigna automáticamente al guardar
                {IS_DEV_UI && (
                  <code className="ml-1.5 text-[11px] text-ink-4">AAAAMMDDHHMM + homoclave</code>
                )}
              </p>
              <div className="mt-3">
                <StepIndicator steps={WIZARD_STEPS} current={step} onStepClick={setStep} />
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
                      Hotel
                    </label>
                    {sessionHotel ? (
                      <Input
                        value={sessionHotel.name}
                        readOnly
                        aria-label="Hotel"
                        title="Solo puedes crear requisiciones de tu hotel"
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
                            <SelectTrigger id="req-hotel" aria-label="Hotel" className="w-full">
                              <SelectValue
                                placeholder={
                                  options !== undefined && options.hotels.length === 0
                                    ? 'Aún no hay clientes activos'
                                    : 'Elige el hotel'
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
                        Un hotel puede pedir gente cuando llega a Naranja — cliente activo.
                      </span>
                    )}
                    {errors.hotelId && (
                      <span className="text-xs text-red">{errors.hotelId.message}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="req-department" className="text-sm font-medium text-ink-2">
                      Departamento del hotel
                    </label>
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
                            aria-label="Departamento del hotel"
                            className="w-full"
                          >
                            <SelectValue placeholder="Elige el departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            {(options?.departments ?? []).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <fieldset>
                  <legend className="text-base font-semibold text-ink">
                    Posiciones solicitadas
                  </legend>
                  <p className="mt-1 text-sm text-ink-3">
                    {IS_DEV_UI
                      ? 'Cada unidad de Cantidad genera un slot: la fila que se bloquea al ocupar (D-02, RR-15)'
                      : 'Cada unidad de Cantidad es un lugar por cubrir'}
                  </p>

                  <div className="mt-4 flex flex-col gap-4">
                    {fields.map((field, index) => {
                      const quantity = Number(positions[index]?.quantity ?? 0) || 0
                      const rowError = firstRowError(errors, index)

                      return (
                        <div
                          key={field.id}
                          className={cn(
                            'rounded-lg border border-line p-4',
                            rowError && 'border-red',
                          )}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">Posición {index + 1}</p>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-o-50 px-2.5 py-1 text-sm font-medium whitespace-nowrap text-o-700">
                                <span
                                  className="material-icons-outlined text-base leading-none"
                                  aria-hidden
                                >
                                  layers
                                </span>
                                {quantity} {quantity === 1 ? 'slot libre' : 'slots libres'}
                              </span>
                              <button
                                type="button"
                                disabled={fields.length === 1}
                                onClick={() => {
                                  remove(index)
                                }}
                                aria-label={`Quitar posición ${String(index + 1)}`}
                                className="cursor-pointer rounded-md px-2 py-1 text-sm text-ink-3 hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">Posición</span>
                              <Controller
                                control={control}
                                name={positionPath(index, 'catalogPositionId')}
                                render={({ field: f }) => (
                                  <Select
                                    {...(f.value ? { value: f.value } : {})}
                                    onValueChange={f.onChange}
                                  >
                                    <SelectTrigger
                                      aria-label={`Posición ${String(index + 1)}`}
                                      className="w-full font-semibold"
                                    >
                                      <SelectValue placeholder="Elige la posición" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(options?.positions ?? []).map((item) => (
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
                              <span className="text-xs font-medium text-ink-3">Modalidad</span>
                              <Controller
                                control={control}
                                name={positionPath(index, 'hiringModalityId')}
                                render={({ field: f }) => (
                                  <Select
                                    {...(f.value ? { value: f.value } : {})}
                                    onValueChange={f.onChange}
                                  >
                                    <SelectTrigger
                                      aria-label={`Modalidad ${String(index + 1)}`}
                                      className="w-full"
                                    >
                                      <SelectValue placeholder="Elige la modalidad" />
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
                              <span className="text-xs font-medium text-ink-3">Inglés</span>
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
                                      aria-label={`Inglés ${String(index + 1)}`}
                                      className="w-full"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NO_ENGLISH}>No requerido</SelectItem>
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

                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-ink-3">Departamento</span>
                              <Controller
                                control={control}
                                name={positionPath(index, 'hotelDepartmentId')}
                                render={({ field: f }) => (
                                  <Select
                                    {...(f.value ? { value: f.value } : {})}
                                    onValueChange={f.onChange}
                                  >
                                    <SelectTrigger
                                      aria-label={`Departamento ${String(index + 1)}`}
                                      className="w-full"
                                    >
                                      <SelectValue placeholder="Elige el departamento" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(options?.departments ?? []).map((item) => (
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
                              <span className="text-xs font-medium text-ink-3">Cantidad</span>
                              <Input
                                {...register(positionPath(index, 'quantity'))}
                                inputMode="numeric"
                                aria-label={`Cantidad ${String(index + 1)}`}
                              />
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                              <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-ink-3">Inicio</span>
                                <Input
                                  type="date"
                                  {...register(positionPath(index, 'startDate'))}
                                  aria-label={`Inicio ${String(index + 1)}`}
                                />
                              </label>
                              <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-ink-3">Hora</span>
                                <Input
                                  type="time"
                                  {...register(positionPath(index, 'startTime'))}
                                  aria-label={`Hora ${String(index + 1)}`}
                                />
                              </label>
                            </div>
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
                      + Agregar posición
                    </Button>
                  </div>
                </fieldset>
              )}

              {step === 3 && (
                <div className="flex max-w-xl flex-col gap-4">
                  <div className="rounded-lg border border-line p-4">
                    <p className="text-xs font-semibold text-ink-3 uppercase">Hotel</p>
                    <p className="mt-1 text-base font-bold text-ink">
                      {hotel?.name ?? sessionHotel?.name ?? '—'}
                    </p>
                    {department !== '' && <p className="text-sm text-ink-2">{department}</p>}
                  </div>
                  <div className="rounded-lg border border-line p-4">
                    <p className="text-xs font-semibold text-ink-3 uppercase">Posiciones</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {positions.map((position, index) => {
                        const label = options?.positions.find(
                          (item) => item.id === position.catalogPositionId,
                        )?.name
                        return (
                          <li
                            key={fields[index]?.id ?? index}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="font-semibold text-ink">
                              {label ?? `Posición ${String(index + 1)}`}
                            </span>
                            <span className="text-ink-2">
                              {Number(position.quantity) || 0}{' '}
                              {Number(position.quantity) === 1 ? 'slot' : 'slots'} · desde{' '}
                              {position.startDate || '—'} · {position.startTime}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="mt-3 border-t border-line pt-3 text-sm font-semibold text-ink">
                      Total: {fields.length} {fields.length === 1 ? 'posición' : 'posiciones'} ·{' '}
                      {totalSlots} {totalSlots === 1 ? 'slot' : 'slots'}
                    </p>
                  </div>
                  <p className="rounded-xl bg-o-50 px-4 py-3 text-xs leading-relaxed text-o-700">
                    Nace en Borrador: para que Reclutamiento la vea, un Manager debe autorizarla —
                    la urgencia corre desde ese momento.
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
                Total: {fields.length} {fields.length === 1 ? 'posición' : 'posiciones'} ·{' '}
                {totalSlots} {totalSlots === 1 ? 'slot' : 'slots'}
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" type="button" onClick={onClose}>
                  Cancelar
                </Button>
                {step > 1 && (
                  <Button
                    type="button"
                    onClick={() => {
                      setStep(step - 1)
                    }}
                  >
                    Atrás
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
                    Continuar
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    type="submit"
                    form={FORM_ID}
                    disabled={isLoading || !isReviewArmed}
                  >
                    {isLoading ? 'Guardando…' : 'Guardar requisición'}
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

import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form'

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
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { Select } from '@/shared/components/Select'
import { SELECT_FIELD_CLASS, SelectField } from '@/shared/components/SelectField'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'new-requisition'

const CELL_CONTROL =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink hover:border-line focus:border-o-500 focus:bg-surface focus:outline-none'

const HEADERS = [
  '#',
  'Posición',
  'Modalidad',
  'Inglés',
  'Departamento',
  'Cant.',
  'Inicio',
  'Hora',
  'Slots',
]

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

  useEffect(() => {
    if (!isOpen) return
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
                className="absolute top-1/2 left-1/2 h-52 w-auto -translate-x-1/2 -translate-y-1/2 opacity-90"
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
                ? `Zona ${hotel.zoneName} · el Inspector se congela al guardar${IS_DEV_UI ? ' (RR-13)' : ''}`
                : `El Inspector se asigna solo por la zona del hotel${IS_DEV_UI ? ' (RR-13)' : ''}`}
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
              {IS_DEV_UI
                ? 'El número se genera al guardar — AAAAMMDDHHMM + homoclave de 2 caracteres'
                : 'El folio se asigna automáticamente al guardar'}
            </p>
          </header>

          <form
            id={FORM_ID}
            onSubmit={(event) => {
              void onSubmit(event)
            }}
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5"
          >
            {}
            <div className="flex max-w-md flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="req-hotel" className="text-sm font-medium text-ink-2">
                  Hotel
                </label>
                {sessionHotel ? (
                  <input
                    value={sessionHotel.name}
                    readOnly
                    aria-label="Hotel"
                    title="Solo puedes crear requisiciones de tu hotel"
                    className={cn(SELECT_FIELD_CLASS, 'w-full cursor-not-allowed bg-surface-2')}
                  />
                ) : (
                  <SelectField
                    id="req-hotel"
                    {...register('hotelId')}
                    disabled={options !== undefined && options.hotels.length === 0}
                  >
                    <option value="">
                      {options !== undefined && options.hotels.length === 0
                        ? 'Aún no hay clientes activos'
                        : 'Elige el hotel'}
                    </option>
                    {(options?.hotels ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectField>
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
                <SelectField id="req-department" {...register('department')}>
                  <option value="">Elige el departamento</option>
                  {(options?.departments ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            {}
            <fieldset>
              <legend className="text-base font-semibold text-ink">Posiciones solicitadas</legend>
              <p className="mt-1 text-sm text-ink-3">
                {IS_DEV_UI
                  ? 'Cada unidad de Cantidad genera un slot: la fila que se bloquea al ocupar (D-02, RR-15)'
                  : 'Cada unidad de Cantidad es un lugar por cubrir'}
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[62rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      {HEADERS.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="px-2 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                        >
                          {header}
                        </th>
                      ))}
                      <th scope="col" className="px-2 py-3">
                        <span className="sr-only">Quitar</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {fields.map((field, index) => {
                      const quantity = Number(positions[index]?.quantity ?? 0) || 0
                      const rowError = firstRowError(errors, index)

                      return (
                        <tr key={field.id} className="border-b border-line last:border-b-0">
                          <td className="px-2 py-3 text-sm text-ink-3">{index + 1}</td>
                          <td className="px-2 py-3">
                            <Select
                              {...register(positionPath(index, 'catalogPositionId'))}
                              aria-label={`Posición ${String(index + 1)}`}
                              className={cn(
                                CELL_CONTROL,
                                'font-semibold',
                                rowError && 'border-red',
                              )}
                            >
                              <option value="">—</option>
                              {(options?.positions ?? []).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-3">
                            <Select
                              {...register(positionPath(index, 'hiringModalityId'))}
                              aria-label={`Modalidad ${String(index + 1)}`}
                              className={CELL_CONTROL}
                            >
                              <option value="">—</option>
                              {(options?.modalities ?? []).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-3">
                            <Select
                              {...register(positionPath(index, 'englishLevelId'))}
                              aria-label={`Inglés ${String(index + 1)}`}
                              className={CELL_CONTROL}
                            >
                              <option value="">No requerido</option>
                              {(options?.englishLevels ?? []).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-3">
                            {}
                            <Select
                              {...register(positionPath(index, 'hotelDepartmentId'))}
                              aria-label={`Departamento ${String(index + 1)}`}
                              className={CELL_CONTROL}
                            >
                              <option value="">—</option>
                              {(options?.departments ?? []).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-3">
                            <input
                              {...register(positionPath(index, 'quantity'))}
                              inputMode="numeric"
                              aria-label={`Cantidad ${String(index + 1)}`}
                              className={cn(CELL_CONTROL, 'w-16')}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="date"
                              {...register(positionPath(index, 'startDate'))}
                              aria-label={`Inicio ${String(index + 1)}`}
                              className={cn(CELL_CONTROL, 'w-40')}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="time"
                              {...register(positionPath(index, 'startTime'))}
                              aria-label={`Hora ${String(index + 1)}`}
                              className={cn(CELL_CONTROL, 'w-28')}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-o-50 px-2.5 py-1 text-sm font-medium whitespace-nowrap text-o-700">
                              <span
                                className="material-icons-outlined text-base leading-none"
                                aria-hidden
                              >
                                layers
                              </span>
                              {quantity} {quantity === 1 ? 'libre' : 'libres'}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            {}
                            <button
                              type="button"
                              disabled={fields.length === 1}
                              onClick={() => {
                                remove(index)
                              }}
                              aria-label={`Quitar posición ${String(index + 1)}`}
                              className="rounded-md px-2 py-1 text-sm text-ink-3 hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {errors.positions?.root?.message !== undefined && (
                <p className="mt-2 text-sm text-red">{errors.positions.root.message}</p>
              )}
              {fields.map((field, index) => {
                const rowError = firstRowError(errors, index)
                return rowError === undefined ? null : (
                  <p key={field.id} className="mt-2 text-sm text-red">
                    Posición {index + 1}: {rowError}
                  </p>
                )
              })}

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
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" form={FORM_ID} disabled={isLoading}>
                {isLoading ? 'Guardando…' : 'Guardar requisición'}
              </Button>
            </div>
          </footer>
        </section>
      </div>
    </Modal>
  )
}

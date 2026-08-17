import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@oranje/ui'
import { useEffect, type ReactNode } from 'react'
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form'

import {
  useCreateRequisitionMutation,
  useGetRequisitionFormOptionsQuery,
} from '../api/requisitionsApi'
import { POSITION_MODALITIES, POSITION_MODALITY_LABEL } from '../types/requisition.types'
import {
  emptyPositionDraft,
  requisitionFormSchema,
  type RequisitionForm,
  type RequisitionPositionDraft,
} from '../types/requisitionForm.schema'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { ENGLISH_LEVEL_LABEL, ENGLISH_LEVELS } from '@/shared/constants/catalogs'
import {
  AUTHORIZATION_TRANSITION,
  REQUISITION_STATUS_LABEL,
} from '@/shared/constants/requisitionStatus'

const FORM_ID = 'new-requisition'

const HEADER_CONTROL =
  'w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink focus:border-o-500 focus:outline-none disabled:bg-surface-2 disabled:text-ink-3'

/**
 * Los controles de la tabla van sin marco hasta que se enfocan: la maqueta la
 * dibuja como una tabla de lectura, y con nueve recuadros por fila el bloque se
 * vuelve ilegible.
 */
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

/** La ruta de un campo del arreglo con el tipo que espera React Hook Form. */
function positionPath<K extends keyof RequisitionPositionDraft>(
  index: number,
  key: K,
): `positions.${number}.${K}` {
  return `positions.${String(index)}.${key}` as `positions.${number}.${K}`
}

/** Los campos de una fila, para buscar su primer error sin recorrer `unknown`. */
const POSITION_FIELDS = [
  'positionName',
  'quantity',
  'department',
  'startDate',
  'startTime',
] as const

/** El primer error de la fila, para no apilar cinco mensajes bajo la tabla. */
function firstRowError(errors: FieldErrors<RequisitionForm>, index: number): string | undefined {
  const row = errors.positions?.[index]
  if (!row) return undefined

  for (const field of POSITION_FIELDS) {
    const message = row[field]?.message
    if (typeof message === 'string') return message
  }

  return undefined
}

/**
 * Alta de una requisición.
 *
 * El número NO se pide: lo genera el backend al guardar. El inspector tampoco
 * se elige — sale de la zona del hotel (RR-13) —, así que el campo se muestra
 * bloqueado en vez de esconderlo: quien firma tiene que saber a quién le va a
 * tocar antes de guardar.
 */
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
    reset,
    formState: { errors },
  } = useForm<RequisitionForm>({
    resolver: zodResolver(requisitionFormSchema),
    defaultValues: {
      hotelId: '',
      department: '',
      areaManagerId: '',
      positions: [emptyPositionDraft('')],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'positions' })

  useEffect(() => {
    if (!isOpen) return
    reset({ hotelId: '', department: '', areaManagerId: '', positions: [emptyPositionDraft('')] })
  }, [isOpen, reset])

  const hotelId = watch('hotelId')
  const department = watch('department')
  const positions = watch('positions')

  const hotel = options?.hotels.find((item) => item.id === hotelId) ?? null

  // Los slots son la cantidad: una fila que pide 4 camaristas nace con 4 slots
  // libres. Es aritmética de esta misma pantalla, no un agregado del servidor.
  const totalSlots = positions.reduce(
    (total, position) => total + (Number(position.quantity) || 0),
    0,
  )

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createRequisition({
        hotelId: values.hotelId,
        department: values.department,
        areaManagerId: values.areaManagerId,
        positions: values.positions.map((position) => ({
          positionName: position.positionName,
          modality: position.modality,
          english: position.english,
          department: position.department,
          quantity: Number(position.quantity),
          startDate: position.startDate,
          startTime: position.startTime,
        })),
      }).unwrap()
      onClose()
    } catch {
      setError('root', { message: 'No se pudo guardar la requisición. Reintenta.' })
    }
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva requisición"
      description="El número se genera al guardar — AAAAMMDDHHMM + homoclave de 2 caracteres"
      className="max-w-[76rem]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={isLoading}>
            Guardar requisición
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        className="flex flex-col gap-5"
      >
        <fieldset className="rounded-xl border border-line p-5">
          <legend className="px-1 text-lg font-semibold text-ink">Cabecera</legend>
          {/*
            El estado de nacimiento sale de las constantes y no escrito a mano:
            si el semáforo se corrige, esta frase se corrige con él.
          */}
          <p className="text-sm text-ink-3">
            Nace en {REQUISITION_STATUS_LABEL[AUTHORIZATION_TRANSITION.from]} — por autorizar. El
            Inspector se asigna solo por la zona del hotel (RR-13)
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-ink-3">Hotel</span>
              <select {...register('hotelId')} className={HEADER_CONTROL}>
                <option value="">Elige el hotel</option>
                {(options?.hotels ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {errors.hotelId && <span className="text-xs text-red">{errors.hotelId.message}</span>}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-ink-3">Departamento del hotel</span>
              <select {...register('department')} className={HEADER_CONTROL}>
                <option value="">Elige el departamento</option>
                {(options?.departments ?? []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {errors.department && (
                <span className="text-xs text-red">{errors.department.message}</span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-ink-3">GH responsable del área</span>
              <select {...register('areaManagerId')} className={HEADER_CONTROL}>
                <option value="">Elige al responsable</option>
                {(options?.areaManagers ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {errors.areaManagerId && (
                <span className="text-xs text-red">{errors.areaManagerId.message}</span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-ink-3">Inspector de zona</span>
              <input
                readOnly
                disabled
                value={hotel ? `${hotel.inspectorName} — zona ${hotel.zoneName}` : ''}
                placeholder="Se asigna al elegir el hotel"
                className={HEADER_CONTROL}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-line p-5">
          <legend className="px-1 text-lg font-semibold text-ink">Posiciones solicitadas</legend>
          <p className="text-sm text-ink-3">
            Cada unidad de Cantidad genera un slot: la fila que se bloquea al ocupar (D-02, RR-15)
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
                        <input
                          {...register(positionPath(index, 'positionName'))}
                          placeholder="Camarista"
                          aria-label={`Posición ${String(index + 1)}`}
                          className={cn(CELL_CONTROL, 'font-semibold', rowError && 'border-red')}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <select
                          {...register(positionPath(index, 'modality'))}
                          aria-label={`Modalidad ${String(index + 1)}`}
                          className={CELL_CONTROL}
                        >
                          {POSITION_MODALITIES.map((modality) => (
                            <option key={modality} value={modality}>
                              {POSITION_MODALITY_LABEL[modality]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <select
                          {...register(positionPath(index, 'english'))}
                          aria-label={`Inglés ${String(index + 1)}`}
                          className={CELL_CONTROL}
                        >
                          {ENGLISH_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {ENGLISH_LEVEL_LABEL[level]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        {/* Cada posición lleva SU departamento: la cabecera solo
                            propone el más común, y una requisición puede pedir
                            gente para dos áreas del mismo hotel. */}
                        <select
                          {...register(positionPath(index, 'department'))}
                          aria-label={`Departamento ${String(index + 1)}`}
                          className={CELL_CONTROL}
                        >
                          <option value="">—</option>
                          {(options?.departments ?? []).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
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
                        {/* La última no se puede quitar: una requisición sin
                            posiciones no pide nada. */}
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="secondary"
              onClick={() => {
                append(emptyPositionDraft(department))
              }}
            >
              + Agregar posición
            </Button>

            <p className="text-base font-semibold text-ink">
              Total: {fields.length} {fields.length === 1 ? 'posición' : 'posiciones'} ·{' '}
              {totalSlots} {totalSlots === 1 ? 'slot' : 'slots'}
            </p>
          </div>
        </fieldset>

        {errors.root?.message !== undefined && (
          <p className="text-sm text-red">{errors.root.message}</p>
        )}
      </form>
    </Modal>
  )
}

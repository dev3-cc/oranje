import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@oranje/ui'
import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import {
  useRegisterContactAttemptMutation,
  useUpdateContactAttemptMutation,
} from '../api/onboardingApi'
import type { ContactAttempt, HotelContact } from '../types/prospect.types'
import {
  registerContactAttemptSchema,
  type RegisterContactAttemptForm,
} from '../types/registerContactAttempt.schema'

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { Modal } from '@/shared/components/Modal'
import {
  CONTACT_ATTEMPT_OUTCOME_LABEL,
  CONTACT_ATTEMPT_OUTCOMES,
  CONTACT_ATTEMPT_TYPE_LABEL,
  CONTACT_ATTEMPT_TYPES,
} from '@/shared/constants/contactAttempt'

/** El botón de envío vive en el pie del modal, fuera del `<form>`: los une este id. */
const FORM_ID = 'register-contact-attempt'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

/**
 * `datetime-local` espera `YYYY-MM-DDTHH:mm` en hora LOCAL. `toISOString()` da
 * UTC y en México adelantaría el valor cinco o seis horas.
 */
function toDateTimeInput(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function nowForDateTimeInput(): string {
  return toDateTimeInput(new Date())
}

export interface RegisterAttemptDialogProps {
  isOpen: boolean
  onClose: () => void
  prospectId: string
  hotelName: string
  contacts: HotelContact[]
  /** Con intento, el diálogo corrige en vez de registrar (solo su autor llega aquí). */
  attempt?: ContactAttempt
}

/**
 * Alta de un intento de contacto.
 *
 * El tipo y el resultado son listas CERRADAS que viven en código, no catálogos
 * que se pidan al backend: el diseño lo dice y es la diferencia con el motivo
 * del cambio de estado, que sí sale de `catalogs.status_change_reason`.
 *
 * El contacto es opcional a propósito — una visita en frío puede no encontrar a
 * nadie— y por eso la primera opción del select es «sin contacto».
 */
export function RegisterAttemptDialog({
  isOpen,
  onClose,
  prospectId,
  hotelName,
  contacts,
  attempt,
}: RegisterAttemptDialogProps): ReactNode {
  const isEditing = attempt !== undefined
  const [registerAttempt, { isLoading: isCreating, error: createError }] =
    useRegisterContactAttemptMutation()
  const [updateAttempt, { isLoading: isUpdating, error: updateError }] =
    useUpdateContactAttemptMutation()
  const isLoading = isCreating || isUpdating
  const saveError = isEditing ? updateError : createError

  const { register, handleSubmit, setValue, watch, reset, formState } =
    useForm<RegisterContactAttemptForm>({
      resolver: zodResolver(registerContactAttemptSchema),
      // Valida al escribir para poder bloquear el envío hasta que el alta sea válida.
      mode: 'onChange',
      defaultValues: { hotelContactId: '', notes: '', occurredAt: nowForDateTimeInput() },
    })

  // Al abrir: de cero para registrar, o con los datos del intento al corregir.
  useEffect(() => {
    if (!isOpen) return
    if (attempt) {
      reset({
        attemptType: attempt.typeCode as RegisterContactAttemptForm['attemptType'],
        outcome: attempt.outcomeCode as RegisterContactAttemptForm['outcome'],
        hotelContactId: attempt.contactId ?? '',
        notes: attempt.notes,
        occurredAt: toDateTimeInput(new Date(attempt.occurredAt)),
      })
    } else {
      reset({ hotelContactId: '', notes: '', occurredAt: nowForDateTimeInput() })
    }
  }, [isOpen, attempt, reset])

  const attemptType = watch('attemptType')
  const outcome = watch('outcome')

  async function onSubmit(values: RegisterContactAttemptForm): Promise<void> {
    try {
      if (attempt) {
        await updateAttempt({
          prospectId,
          attemptId: attempt.id,
          attemptType: values.attemptType,
          outcome: values.outcome,
          occurredAt: values.occurredAt,
          hotelContactId: values.hotelContactId || null,
          notes: values.notes || null,
        }).unwrap()
      } else {
        await registerAttempt({
          prospectId,
          attemptType: values.attemptType,
          outcome: values.outcome,
          occurredAt: values.occurredAt,
          ...(values.hotelContactId ? { hotelContactId: values.hotelContactId } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        }).unwrap()
      }
      onClose()
    } catch {
      // El error queda en `saveError` y se pinta abajo; el modal no se cierra.
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Corregir intento de contacto' : 'Registrar intento de contacto'}
      description={`${hotelName} · commercial.contact_attempt`}
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={!formState.isValid || isLoading}
          >
            {isLoading ? 'Guardando…' : isEditing ? 'Guardar corrección' : 'Registrar intento'}
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
        className="flex flex-col gap-5"
      >
        <FormField
          label="Tipo de intento"
          hint="attempt_type — lista cerrada con CHECK, no catálogo"
          error={formState.errors.attemptType && 'Elige el tipo de intento'}
        >
          <div className="grid grid-cols-3 gap-3">
            {CONTACT_ATTEMPT_TYPES.map((type) => {
              const isSelected = attemptType === type

              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setValue('attemptType', type, { shouldValidate: true })
                  }}
                  className={cn(
                    'rounded-md px-4 py-3 text-sm transition-colors',
                    isSelected
                      ? 'border-2 border-o-500 bg-o-50 font-semibold text-ink'
                      : 'border border-line bg-surface text-ink-2 hover:bg-surface-2',
                  )}
                >
                  {CONTACT_ATTEMPT_TYPE_LABEL[type]}
                </button>
              )
            })}
          </div>
        </FormField>

        <FormField
          label="Contacto del hotel"
          htmlFor="hotelContactId"
          hint="hotel_contact_id es opcional: una visita en frío puede no encontrar a nadie"
        >
          <select id="hotelContactId" {...register('hotelContactId')} className={CONTROL_CLASS}>
            <option value="">Sin contacto identificado</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} · {contact.role}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Resultado"
          htmlFor="outcome"
          hint="outcome — no contestó · interesado · no interesado · cita agendada"
          error={formState.errors.outcome && 'Elige el resultado del intento'}
        >
          <select
            id="outcome"
            {...register('outcome')}
            className={cn(CONTROL_CLASS, outcome ? 'text-ink' : 'text-ink-4')}
          >
            <option value="">Selecciona un resultado...</option>
            {CONTACT_ATTEMPT_OUTCOMES.map((value) => (
              <option key={value} value={value} className="text-ink">
                {CONTACT_ATTEMPT_OUTCOME_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Fecha y hora"
          htmlFor="occurredAt"
          error={formState.errors.occurredAt && 'Indica cuándo ocurrió el intento'}
        >
          <input
            id="occurredAt"
            type="datetime-local"
            {...register('occurredAt')}
            className={cn(CONTROL_CLASS, 'text-ink')}
          />
        </FormField>

        <FormField label="Notas" htmlFor="notes">
          <input
            id="notes"
            type="text"
            placeholder="Escribe una nota..."
            {...register('notes')}
            className={cn(CONTROL_CLASS, 'text-ink')}
          />
        </FormField>

        {saveError !== undefined && (
          <p className="rounded-md bg-red/10 p-4 text-sm text-red">
            {isEditing
              ? 'No se pudo corregir el intento. Solo su autor puede hacerlo.'
              : 'No se pudo registrar el intento. Revisa los datos e inténtalo de nuevo.'}
          </p>
        )}
      </form>
    </Modal>
  )
}

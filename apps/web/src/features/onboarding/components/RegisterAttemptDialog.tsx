import { zodResolver } from '@hookform/resolvers/zod'
import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'

import {
  useRegisterContactAttemptMutation,
  useUpdateContactAttemptMutation,
} from '../api/onboardingApi'
import type { ContactAttempt, HotelContact } from '../types/prospect.types'
import {
  registerContactAttemptSchema,
  type RegisterContactAttemptForm,
} from '../types/registerContactAttempt.schema'

import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeNotificaciones from '@/assets/ilustrations/personaje-notificaciones.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import {
  CONTACT_ATTEMPT_OUTCOME_LABEL,
  CONTACT_ATTEMPT_OUTCOMES,
  CONTACT_ATTEMPT_TYPE_LABEL,
  CONTACT_ATTEMPT_TYPES,
} from '@/shared/constants/contactAttempt'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'register-contact-attempt'

const INTRO_SLIDES = [
  {
    image: personajeNotificaciones,
    title: 'Cada intento cuenta la historia',
    text: 'La bitácora del prospecto vive de estos registros: quién buscó al hotel, cuándo y por qué canal.',
  },
  {
    image: personajeEncuesta,
    title: 'Canal y resultado, de la lista',
    text: 'Tipo y resultado salen de listas cerradas — así los reportes pueden agrupar sin adivinar.',
  },
  {
    image: personajeRetro,
    title: 'Solo su autor corrige',
    text: 'Un intento puede corregirse o borrarse, pero únicamente por quien lo registró.',
  },
] as const

const NO_CONTACT = 'NONE'

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
  attempt?: ContactAttempt
}

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

  const { register, control, handleSubmit, setValue, watch, reset, formState } =
    useForm<RegisterContactAttemptForm>({
      resolver: zodResolver(registerContactAttemptSchema),
      mode: 'onChange',
      defaultValues: { hotelContactId: '', notes: '', occurredAt: nowForDateTimeInput() },
    })

  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setShowIntro(attempt === undefined)
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
        toast.success('Intento corregido')
      } else {
        await registerAttempt({
          prospectId,
          attemptType: values.attemptType,
          outcome: values.outcome,
          occurredAt: values.occurredAt,
          ...(values.hotelContactId ? { hotelContactId: values.hotelContactId } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        }).unwrap()
        toast.success('Intento registrado')
      }
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Corregir intento de contacto' : 'Registrar intento de contacto'}
      description={IS_DEV_UI ? `${hotelName} · commercial.contact_attempt` : hotelName}
      footer={
        showIntro ? null : (
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
        )
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Registrar el intento"
          onDone={() => {
            setShowIntro(false)
          }}
        />
      ) : (
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
            hint={
              IS_DEV_UI
                ? 'attempt_type — lista cerrada con CHECK, no catálogo'
                : 'Por dónde buscaste al hotel'
            }
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
            hint={
              IS_DEV_UI
                ? 'hotel_contact_id es opcional: una visita en frío puede no encontrar a nadie'
                : 'Opcional: en una visita en frío puedes no encontrar a nadie'
            }
          >
            <Controller
              control={control}
              name="hotelContactId"
              render={({ field }) => (
                <Select
                  value={field.value === '' ? NO_CONTACT : field.value}
                  onValueChange={(value) => {
                    field.onChange(value === NO_CONTACT ? '' : value)
                  }}
                >
                  <SelectTrigger id="hotelContactId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>Sin contacto identificado</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} · {contact.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Resultado"
            htmlFor="outcome"
            hint={
              IS_DEV_UI
                ? 'outcome — no contestó · interesado · no interesado · cita agendada'
                : 'Qué pasó con este intento'
            }
            error={formState.errors.outcome && 'Elige el resultado del intento'}
          >
            <Controller
              control={control}
              name="outcome"
              render={({ field }) => (
                <Select
                  {...(field.value ? { value: field.value } : {})}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="outcome" className="w-full">
                    <SelectValue placeholder="Elige el resultado…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ATTEMPT_OUTCOMES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CONTACT_ATTEMPT_OUTCOME_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Fecha y hora"
            htmlFor="occurredAt"
            error={formState.errors.occurredAt && 'Indica cuándo ocurrió el intento'}
          >
            <Input id="occurredAt" type="datetime-local" {...register('occurredAt')} />
          </FormField>

          <FormField label="Notas" htmlFor="notes">
            <Input
              id="notes"
              type="text"
              placeholder="Pidió que llamáramos la próxima semana"
              {...register('notes')}
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
      )}
    </Modal>
  )
}

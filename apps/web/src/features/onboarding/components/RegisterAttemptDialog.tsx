import { zodResolver } from '@hookform/resolvers/zod'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'

import {
  useRegisterContactAttemptMutation,
  useUpdateContactAttemptMutation,
} from '../api/onboardingApi'
import type { ContactAttempt, HotelContact } from '../types/prospect.types'
import {
  buildRegisterContactAttemptSchema,
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

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeNotificaciones,
    title: msg`Cada intento cuenta la historia`,
    text: msg`La bitácora del prospecto vive de estos registros: quién buscó al hotel, cuándo y por qué canal.`,
  },
  {
    image: personajeEncuesta,
    title: msg`Canal y resultado, de la lista`,
    text: msg`Tipo y resultado salen de listas cerradas — así los reportes pueden agrupar sin adivinar.`,
  },
  {
    image: personajeRetro,
    title: msg`Solo su autor corrige`,
    text: msg`Un intento puede corregirse o borrarse, pero únicamente por quien lo registró.`,
  },
]

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
  const { t, i18n } = useLingui()
  const isEditing = attempt !== undefined
  const [registerAttempt, { isLoading: isCreating, error: createError }] =
    useRegisterContactAttemptMutation()
  const [updateAttempt, { isLoading: isUpdating, error: updateError }] =
    useUpdateContactAttemptMutation()
  const isLoading = isCreating || isUpdating
  const saveError = isEditing ? updateError : createError

  /* Los mensajes del esquema se resuelven al armarlo, así que se rearma al
     cambiar de idioma: `i18n` no cambia de identidad al activar otro (D-36). */
  const schema = useMemo(() => buildRegisterContactAttemptSchema(i18n), [i18n, i18n.locale])

  const { register, control, handleSubmit, setValue, watch, reset, formState } =
    useForm<RegisterContactAttemptForm>({
      resolver: zodResolver(schema),
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
        toast.success(t`Intento corregido`)
      } else {
        await registerAttempt({
          prospectId,
          attemptType: values.attemptType,
          outcome: values.outcome,
          occurredAt: values.occurredAt,
          ...(values.hotelContactId ? { hotelContactId: values.hotelContactId } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        }).unwrap()
        toast.success(t`Intento registrado`)
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
      title={isEditing ? t`Corregir intento de contacto` : t`Registrar intento de contacto`}
      description={IS_DEV_UI ? `${hotelName} · commercial.contact_attempt` : hotelName}
      footer={
        showIntro ? null : (
          <>
            <Button onClick={onClose} disabled={isLoading}>
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              type="submit"
              form={FORM_ID}
              disabled={!formState.isValid || isLoading}
            >
              {isLoading ? (
                <Trans>Guardando…</Trans>
              ) : isEditing ? (
                <Trans>Guardar corrección</Trans>
              ) : (
                <Trans>Registrar intento</Trans>
              )}
            </Button>
          </>
        )
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Registrar el intento`}
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
            label={t`Tipo de intento`}
            hint={
              IS_DEV_UI
                ? 'attempt_type — lista cerrada con CHECK, no catálogo'
                : t`Por dónde buscaste al hotel`
            }
            error={formState.errors.attemptType && t`Elige el tipo de intento`}
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
            label={t`Contacto del hotel`}
            htmlFor="hotelContactId"
            hint={
              IS_DEV_UI
                ? 'hotel_contact_id es opcional: una visita en frío puede no encontrar a nadie'
                : t`Opcional: en una visita en frío puedes no encontrar a nadie`
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
                    <SelectItem value={NO_CONTACT}>
                      <Trans>Sin contacto identificado</Trans>
                    </SelectItem>
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
            label={t`Resultado`}
            htmlFor="outcome"
            hint={
              IS_DEV_UI
                ? 'outcome — no contestó · interesado · no interesado · cita agendada'
                : t`Qué pasó con este intento`
            }
            error={formState.errors.outcome && t`Elige el resultado del intento`}
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
                    <SelectValue placeholder={t`Elige el resultado…`} />
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
            label={t`Fecha y hora`}
            htmlFor="occurredAt"
            error={formState.errors.occurredAt && t`Indica cuándo ocurrió el intento`}
          >
            <Input id="occurredAt" type="datetime-local" {...register('occurredAt')} />
          </FormField>

          <FormField label={t`Notas`} htmlFor="notes">
            <Input
              id="notes"
              type="text"
              placeholder={t`Pidió que llamáramos la próxima semana`}
              {...register('notes')}
            />
          </FormField>

          {saveError !== undefined && (
            <p className="rounded-md bg-red/10 p-4 text-sm text-red">
              {isEditing ? (
                <Trans>No se pudo corregir el intento. Solo su autor puede hacerlo.</Trans>
              ) : (
                <Trans>
                  No se pudo registrar el intento. Revisa los datos e inténtalo de nuevo.
                </Trans>
              )}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}

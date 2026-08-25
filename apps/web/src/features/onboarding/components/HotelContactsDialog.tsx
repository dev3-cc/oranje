import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

import { useAddHotelContactsMutation } from '../api/onboardingApi'
import {
  EMPTY_CONTACT_DRAFT,
  hotelContactsFormSchema,
  type HotelContactDraft,
  type HotelContactsForm,
} from '../types/hotelContactsForm.schema'
import type { HotelContact } from '../types/prospect.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FORM_ID = 'hotel-contacts-form'

const CONTROL_CLASS =
  'w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

function draftPath<K extends keyof HotelContactDraft>(
  index: number,
  key: K,
): `drafts.${number}.${K}` {
  return `drafts.${String(index)}.${key}` as `drafts.${number}.${K}`
}

function Field({
  label,
  column,
  required,
  error,
  children,
}: {
  label: string
  column: string
  required?: boolean
  error?: string | undefined
  children: ReactNode
}): ReactNode {
  return (
    <div>
      <p className="flex items-baseline gap-2 text-sm font-semibold text-ink">
        {label}
        {required === true && (
          <span className="text-xs font-bold text-red">
            {IS_DEV_UI ? 'NOT NULL' : 'obligatorio'}
          </span>
        )}
      </p>
      <div className="mt-2">{children}</div>
      {}
      <p className={cn('mt-1.5 text-xs', error === undefined ? 'text-ink-4' : 'text-red')}>
        {error ?? (IS_DEV_UI ? column : '\u00a0')}
      </p>
    </div>
  )
}

export function HotelContactsDialog({
  isOpen,
  onClose,
  prospectId,
  hotelName,
  contacts,
}: {
  isOpen: boolean
  onClose: () => void
  prospectId: string
  hotelName: string
  contacts: HotelContact[]
}): ReactNode {
  const [addContacts, { isLoading }] = useAddHotelContactsMutation()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<HotelContactsForm>({
    resolver: zodResolver(hotelContactsFormSchema),
    defaultValues: { drafts: [EMPTY_CONTACT_DRAFT] },
  })

  const { fields, append } = useFieldArray({ control, name: 'drafts' })

  useEffect(() => {
    if (!isOpen) return
    reset({ drafts: [EMPTY_CONTACT_DRAFT] })
    setSelectedIndex(0)
  }, [isOpen, reset])

  const drafts = watch('drafts')
  const currentPrimary = contacts.find((contact) => contact.isPrimary) ?? null
  const draftError = errors.drafts?.[selectedIndex]

  function markPrimary(index: number, isOn: boolean): void {
    drafts.forEach((_, position) => {
      setValue(draftPath(position, 'isPrimary'), isOn && position === index)
    })
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addContacts({
        prospectId,
        contacts: values.drafts.map((draft) => ({
          fullName: draft.fullName,
          jobTitle: draft.jobTitle,
          phone: draft.phone,
          email: draft.email,
          isPrimary: draft.isPrimary,
        })),
      }).unwrap()
      onClose()
    } catch {
      return
    }
  })

  const pendingLabel =
    fields.length === 1 ? '1 sin guardar' : `${String(fields.length)} sin guardar`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar contacto"
      description={IS_DEV_UI ? `commercial.hotel_contact · ${hotelName}` : hotelName}
      className="max-w-[64rem]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={isLoading}>
            {fields.length === 1
              ? 'Agregar contacto'
              : `Agregar ${String(fields.length)} contactos`}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]"
      >
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-3">
              {contacts.length} registrados · {pendingLabel}
            </p>
            <button
              type="button"
              onClick={() => {
                append(EMPTY_CONTACT_DRAFT)
                setSelectedIndex(fields.length)
              }}
              className="rounded-md bg-o-50 px-3 py-1.5 text-sm font-medium text-o-700 hover:bg-o-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              + Agregar contacto
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-3">
            {contacts.map((contact) => (
              <li key={contact.id} className="rounded-lg border border-line bg-surface-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-semibold text-ink">{contact.name}</p>
                  {contact.isPrimary && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-o-500 px-2.5 py-1 text-xs font-semibold text-o-700">
                      <span className="size-1.5 rounded-full bg-o-500" aria-hidden />
                      Principal
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink-3">{contact.role}</p>
                <p className="mt-0.5 text-sm text-ink-3">{contact.phone}</p>
              </li>
            ))}

            {fields.map((field, index) => (
              <li key={field.id}>
                <button
                  type="button"
                  aria-current={index === selectedIndex ? 'true' : undefined}
                  onClick={() => {
                    setSelectedIndex(index)
                  }}
                  className={cn(
                    'w-full rounded-lg border-2 border-dashed px-4 py-3 text-left',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                    index === selectedIndex
                      ? 'border-o-500 bg-o-50'
                      : 'border-line hover:bg-surface-2',
                  )}
                >
                  <p className="text-base font-semibold text-o-700">
                    {drafts[index]?.fullName === '' || drafts[index] === undefined
                      ? 'Contacto nuevo'
                      : drafts[index].fullName}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-3">sin guardar</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <fieldset className="rounded-xl border border-line bg-surface-2/60 p-5">
            <legend className="px-1 text-base font-semibold text-ink">
              Contacto nuevo · {hotelName}
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre completo"
                column="full_name"
                required
                error={draftError?.fullName?.message}
              >
                <input
                  {...register(draftPath(selectedIndex, 'fullName'))}
                  placeholder="Nombre y apellidos"
                  className={cn(
                    CONTROL_CLASS,
                    draftError?.fullName ? 'border-red' : 'border-o-500',
                  )}
                />
              </Field>

              <Field label="Puesto" column="job_title">
                <input
                  {...register(draftPath(selectedIndex, 'jobTitle'))}
                  placeholder="Ej. Ama de Llaves"
                  className={CONTROL_CLASS}
                />
              </Field>

              <Field label="Teléfono" column="phone">
                <input
                  {...register(draftPath(selectedIndex, 'phone'))}
                  placeholder="+52 …"
                  className={CONTROL_CLASS}
                />
              </Field>

              <Field label="Correo" column="email" error={draftError?.email?.message}>
                <input
                  {...register(draftPath(selectedIndex, 'email'))}
                  placeholder="nombre@hotel.mx"
                  className={CONTROL_CLASS}
                />
              </Field>
            </div>

            <label className="mt-4 flex items-center gap-4 rounded-lg bg-surface-3 px-4 py-3">
              <input
                type="checkbox"
                checked={drafts[selectedIndex]?.isPrimary ?? false}
                onChange={(event) => {
                  markPrimary(selectedIndex, event.target.checked)
                }}
                className="size-5 accent-o-500"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Marcar como principal</span>
                <span className="block text-sm text-ink-3">
                  {IS_DEV_UI && 'is_primary · '}
                  {currentPrimary
                    ? `apagado: ${currentPrimary.name} ya lo es`
                    : 'este hotel no tiene principal todavía'}
                </span>
              </span>
            </label>
          </fieldset>

          <p className="rounded-xl bg-green/15 p-5 text-sm text-ink-2">
            <span className="block font-semibold text-ink">
              Un hotel puede tener los contactos que haga falta
            </span>
            <span className="mt-1 block">
              {IS_DEV_UI
                ? 'hotel_contact solo exige full_name y hotel_id. Puesto, teléfono y correo son opcionales: se registra con lo que se tenga y se completa después.'
                : 'Solo el nombre es obligatorio. Puesto, teléfono y correo se registran con lo que se tenga y se completan después.'}
            </span>
          </p>
        </div>

        <p className="rounded-xl bg-yellow/15 p-5 text-sm text-ink-2 xl:col-span-2">
          <span className="block font-semibold text-o-700">
            Solo puede haber un principal por hotel.
          </span>
          <span className="mt-1 block">
            {IS_DEV_UI
              ? 'Lo hace cumplir ux_hotel_contact_primary, un único parcial sobre hotel_id WHERE is_primary. Marcar a otro no es un simple UPDATE: hay que quitar el anterior en la misma transacción, o el motor rechaza el segundo.'
              : 'Al marcar a otro como principal, el anterior deja de serlo en el mismo guardado.'}
          </span>
        </p>
      </form>
    </Modal>
  )
}

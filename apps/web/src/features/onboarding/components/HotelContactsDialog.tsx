import { zodResolver } from '@hookform/resolvers/zod'
import { cn, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

import {
  useAddHotelContactsMutation,
  useDeleteHotelContactMutation,
  useUpdateHotelContactMutation,
} from '../api/onboardingApi'
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

function deleteErrorCode(error: unknown): string | undefined {
  return (error as { data?: { error?: { code?: string } } } | undefined)?.data?.error?.code
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
        {error ?? (IS_DEV_UI ? column : ' ')}
      </p>
    </div>
  )
}

interface EditDraft {
  fullName: string
  jobTitle: string
  phone: string
  email: string
  isPrimary: boolean
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
  const [updateContact, updateState] = useUpdateHotelContactMutation()
  const [deleteContact, deleteState] = useDeleteHotelContactMutation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isBusy = isLoading || updateState.isLoading || deleteState.isLoading

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
    setEditingId(null)
    setEditDraft(null)
    setConfirmingDelete(false)
    updateState.reset()
    deleteState.reset()
  }, [isOpen, reset])

  const drafts = watch('drafts')
  const currentPrimary = contacts.find((contact) => contact.isPrimary) ?? null
  const draftError = errors.drafts?.[selectedIndex]
  const editingContact = contacts.find((contact) => contact.id === editingId) ?? null
  const isEditing = editingContact !== null && editDraft !== null

  function startEditing(contact: HotelContact): void {
    setEditingId(contact.id)
    setEditDraft({
      fullName: contact.name,
      jobTitle: contact.role,
      phone: contact.phone,
      email: contact.email,
      isPrimary: contact.isPrimary,
    })
    setConfirmingDelete(false)
    updateState.reset()
    deleteState.reset()
  }

  function stopEditing(): void {
    setEditingId(null)
    setEditDraft(null)
    setConfirmingDelete(false)
  }

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

  async function saveEdit(): Promise<void> {
    if (!editingContact || !editDraft) return
    if (editDraft.fullName.trim() === '') return
    try {
      await updateContact({
        prospectId,
        contactId: editingContact.id,
        patch: {
          fullName: editDraft.fullName.trim(),
          jobTitle: editDraft.jobTitle.trim() === '' ? null : editDraft.jobTitle.trim(),
          phone: editDraft.phone.trim() === '' ? null : editDraft.phone.trim(),
          email: editDraft.email.trim() === '' ? null : editDraft.email.trim(),
          isPrimary: editDraft.isPrimary,
        },
      }).unwrap()
      toast.success('Contacto actualizado')
      stopEditing()
    } catch {
      return
    }
  }

  async function removeContact(): Promise<void> {
    if (!editingContact) return
    try {
      await deleteContact({ prospectId, contactId: editingContact.id }).unwrap()
      toast.success('Contacto eliminado')
      stopEditing()
    } catch {
      setConfirmingDelete(false)
    }
  }

  async function deactivateContact(): Promise<void> {
    if (!editingContact) return
    try {
      await updateContact({
        prospectId,
        contactId: editingContact.id,
        patch: { isActive: false },
      }).unwrap()
      toast.success('Contacto desactivado')
      stopEditing()
    } catch {
      return
    }
  }

  const hasAttempts = deleteErrorCode(deleteState.error) === 'CONTACT_HAS_ATTEMPTS'

  const pendingLabel =
    fields.length === 1 ? '1 sin guardar' : `${String(fields.length)} sin guardar`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar contacto' : 'Agregar contacto'}
      description={IS_DEV_UI ? `commercial.hotel_contact · ${hotelName}` : hotelName}
      className="max-w-[64rem]"
      footer={
        isEditing ? (
          <div className="flex w-full flex-wrap items-center gap-3">
            {hasAttempts ? (
              <Button
                disabled={isBusy}
                onClick={() => {
                  void deactivateContact()
                }}
                className="border border-red/40 bg-red/5 font-semibold text-red"
              >
                Desactivar contacto
              </Button>
            ) : (
              <Button
                disabled={isBusy}
                onClick={() => {
                  if (!confirmingDelete) {
                    setConfirmingDelete(true)
                    return
                  }
                  void removeContact()
                }}
                className={cn(
                  'text-red',
                  confirmingDelete && 'border border-red/40 bg-red/5 font-semibold',
                )}
              >
                {confirmingDelete ? 'Sí, eliminar contacto' : 'Eliminar contacto'}
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="secondary" onClick={stopEditing} disabled={isBusy}>
              Cancelar edición
            </Button>
            <Button
              variant="primary"
              disabled={isBusy || editDraft?.fullName.trim() === ''}
              onClick={() => {
                void saveEdit()
              }}
            >
              {updateState.isLoading ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form={FORM_ID} disabled={isBusy}>
              {fields.length === 1
                ? 'Agregar contacto'
                : `Agregar ${String(fields.length)} contactos`}
            </Button>
          </div>
        )
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
                stopEditing()
                append(EMPTY_CONTACT_DRAFT)
                setSelectedIndex(fields.length)
              }}
              className="rounded-md bg-o-50 px-3 py-1.5 text-sm font-medium text-o-700 hover:bg-o-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              Agregar otro contacto
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-3">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  aria-current={contact.id === editingId ? 'true' : undefined}
                  onClick={() => {
                    startEditing(contact)
                  }}
                  className={cn(
                    'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                    contact.id === editingId
                      ? 'border-o-500 bg-o-50'
                      : 'border-line bg-surface-2 hover:border-o-500/40',
                  )}
                >
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
                  <p className="mt-1 text-xs font-medium text-o-700">Editar</p>
                </button>
              </li>
            ))}

            {fields.map((field, index) => (
              <li key={field.id}>
                <button
                  type="button"
                  aria-current={!isEditing && index === selectedIndex ? 'true' : undefined}
                  onClick={() => {
                    stopEditing()
                    setSelectedIndex(index)
                  }}
                  className={cn(
                    'w-full rounded-lg border-2 border-dashed px-4 py-3 text-left',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                    !isEditing && index === selectedIndex
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
          {isEditing && editDraft ? (
            <fieldset className="rounded-xl border border-o-500/50 bg-surface-2/60 p-5">
              <legend className="px-1 text-base font-semibold text-ink">
                Editar contacto · {editingContact.name}
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nombre completo"
                  column="full_name"
                  required
                  error={editDraft.fullName.trim() === '' ? 'Falta el nombre' : undefined}
                >
                  <input
                    value={editDraft.fullName}
                    onChange={(event) => {
                      setEditDraft({ ...editDraft, fullName: event.target.value })
                    }}
                    aria-label="Nombre completo del contacto"
                    placeholder="Laura Méndez"
                    className={CONTROL_CLASS}
                  />
                </Field>

                <Field label="Puesto" column="job_title">
                  <input
                    value={editDraft.jobTitle}
                    onChange={(event) => {
                      setEditDraft({ ...editDraft, jobTitle: event.target.value })
                    }}
                    placeholder="Ama de llaves"
                    className={CONTROL_CLASS}
                  />
                </Field>

                <Field label="Teléfono" column="phone">
                  <input
                    value={editDraft.phone}
                    onChange={(event) => {
                      setEditDraft({ ...editDraft, phone: event.target.value })
                    }}
                    placeholder="+52 998 123 4567"
                    className={CONTROL_CLASS}
                  />
                </Field>

                <Field label="Correo" column="email">
                  <input
                    value={editDraft.email}
                    onChange={(event) => {
                      setEditDraft({ ...editDraft, email: event.target.value })
                    }}
                    placeholder="nombre@hotel.mx"
                    className={CONTROL_CLASS}
                  />
                </Field>
              </div>

              <label className="mt-4 flex items-center gap-4 rounded-lg bg-surface-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={editDraft.isPrimary}
                  onChange={(event) => {
                    setEditDraft({ ...editDraft, isPrimary: event.target.checked })
                  }}
                  className="size-5 accent-o-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    Marcar como principal
                  </span>
                  <span className="block text-sm text-ink-3">
                    {IS_DEV_UI && 'is_primary · '}
                    {currentPrimary && currentPrimary.id !== editingContact.id
                      ? `al guardar, ${currentPrimary.name} deja de serlo`
                      : editingContact.isPrimary
                        ? 'es el principal de este hotel'
                        : 'este hotel no tiene principal todavía'}
                  </span>
                </span>
              </label>

              {(updateState.error !== undefined ||
                (deleteState.error !== undefined && !hasAttempts)) && (
                <p role="alert" className="mt-3 text-sm text-red">
                  No se pudo guardar el contacto. Revisa los datos e inténtalo de nuevo.
                </p>
              )}
              {hasAttempts && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-yellow/15 px-4 py-3 text-sm text-ink-2"
                >
                  Este contacto aparece en la bitácora de intentos, así que no se puede borrar.
                  Desactívalo y dejará de mostrarse.
                </p>
              )}
            </fieldset>
          ) : (
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
                    placeholder="Laura Méndez"
                    className={cn(
                      CONTROL_CLASS,
                      draftError?.fullName ? 'border-red' : 'border-o-500',
                    )}
                  />
                </Field>

                <Field label="Puesto" column="job_title">
                  <input
                    {...register(draftPath(selectedIndex, 'jobTitle'))}
                    placeholder="Ama de llaves"
                    className={CONTROL_CLASS}
                  />
                </Field>

                <Field label="Teléfono" column="phone">
                  <input
                    {...register(draftPath(selectedIndex, 'phone'))}
                    placeholder="+52 998 123 4567"
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
                  <span className="block text-sm font-semibold text-ink">
                    Marcar como principal
                  </span>
                  <span className="block text-sm text-ink-3">
                    {IS_DEV_UI && 'is_primary · '}
                    {currentPrimary
                      ? `${currentPrimary.name} ya es el principal; si marcas este, lo reemplaza`
                      : 'este hotel no tiene principal todavía'}
                  </span>
                </span>
              </label>
            </fieldset>
          )}

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

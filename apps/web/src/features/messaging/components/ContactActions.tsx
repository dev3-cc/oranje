import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Input, toast } from '@oranje/ui'
import { useId, useState, type FormEvent, type ReactNode } from 'react'

import {
  useCreateMessagingContactMutation,
  useDeleteMessagingContactMutation,
  useGetMessagingTagsQuery,
  useOptOutMessagingContactMutation,
  useUpdateMessagingContactMutation,
  type MessagingContact,
  type MessagingContactInput,
} from '../api/messagingApi'

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** «+ Nuevo contacto», con su formulario. */
export function NewContactButton(): ReactNode {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Trans>+ Nuevo contacto</Trans>
      </Button>
      {open && (
        <ContactFormDialog
          contact={null}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Las acciones de una fila, como en la plataforma: Editar, Dar de baja (solo
 * si todavía recibe) y Eliminar. Las dos últimas piden confirmación: la baja
 * es de compliance y no se deshace desde aquí, y eliminar borra su historial.
 */
export function ContactRowActions({ contact }: { contact: MessagingContact }): ReactNode {
  const { i18n } = useLingui()
  const [dialog, setDialog] = useState<'edit' | 'opt-out' | 'delete' | null>(null)
  const [optOut, { isLoading: isOptingOut }] = useOptOutMessagingContactMutation()
  const [remove, { isLoading: isRemoving }] = useDeleteMessagingContactMutation()
  const close = (): void => {
    setDialog(null)
  }
  const name = fullName(contact)

  const run = async (action: () => Promise<unknown>, done: string): Promise<void> => {
    try {
      await action()
      toast.success(done)
      close()
    } catch (error) {
      toast.error(
        apiErrorMessage(error, { fallback: i18n._(msg`No se pudo completar la acción.`) }),
      )
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <ActionLink
        onClick={() => {
          setDialog('edit')
        }}
      >
        <Trans>Editar</Trans>
      </ActionLink>
      {!contact.optedOut && (
        <ActionLink
          onClick={() => {
            setDialog('opt-out')
          }}
        >
          <Trans>Dar de baja</Trans>
        </ActionLink>
      )}
      <ActionLink
        danger
        onClick={() => {
          setDialog('delete')
        }}
      >
        <Trans>Eliminar</Trans>
      </ActionLink>

      {dialog === 'edit' && <ContactFormDialog contact={contact} onClose={close} />}

      <Modal
        isOpen={dialog === 'opt-out'}
        onClose={close}
        title={i18n._(msg`¿Dar de baja a ${name}?`)}
        description={i18n._(
          msg`Ya no recibirá mensajes de ninguna campaña. Es la baja que pide la ley: no se deshace desde aquí.`,
        )}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isOptingOut}
              onClick={() =>
                void run(
                  () => optOut(contact.id).unwrap(),
                  i18n._(msg`${name} quedó dado de baja.`),
                )
              }
            >
              <Trans>Dar de baja</Trans>
            </Button>
          </>
        }
      >
        {null}
      </Modal>

      <Modal
        isOpen={dialog === 'delete'}
        onClose={close}
        title={i18n._(msg`¿Eliminar a ${name}?`)}
        description={i18n._(
          msg`Se borra de la plataforma de mensajería junto con su historial de mensajes. No se puede deshacer.`,
        )}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isRemoving}
              onClick={() =>
                void run(() => remove(contact.id).unwrap(), i18n._(msg`${name} se eliminó.`))
              }
            >
              <Trans>Eliminar</Trans>
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  )
}

function ActionLink({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-surface-2 ${
        danger ? 'text-st-rojo' : 'text-o-700'
      }`}
    >
      {children}
    </button>
  )
}

function fullName(contact: MessagingContact): string {
  return contact.lastName === null ? contact.firstName : `${contact.firstName} ${contact.lastName}`
}

/**
 * Crear (`contact` nulo) o editar. Los mismos campos que la plataforma: nombre,
 * apellido, teléfono con su país, email y etiquetas.
 */
function ContactFormDialog({
  contact,
  onClose,
}: {
  contact: MessagingContact | null
  onClose: () => void
}): ReactNode {
  const { i18n } = useLingui()
  const ids = useId()
  const { data: tagsData } = useGetMessagingTagsQuery()
  const [create, { isLoading: isCreating }] = useCreateMessagingContactMutation()
  const [update, { isLoading: isUpdating }] = useUpdateMessagingContactMutation()
  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [lastName, setLastName] = useState(contact?.lastName ?? '')
  // Al editar se muestra el número guardado, con su `+`: así ya trae el país.
  const [phone, setPhone] = useState(contact === null ? '' : `+${contact.phone}`)
  const [countryCode, setCountryCode] = useState('')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [tagIds, setTagIds] = useState<string[]>(contact?.tags.map((tag) => tag.id) ?? [])
  const [error, setError] = useState<string | null>(null)
  const isSaving = isCreating || isUpdating
  const tags = tagsData?.configured === true ? tagsData.tags : []

  const toggleTag = (id: string): void => {
    setTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id],
    )
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)

    const country = countryCode.trim().toUpperCase()
    const input: MessagingContactInput = {
      firstName: firstName.trim(),
      phone: phone.trim(),
      tagIds,
      ...(country === '' ? {} : { countryCode: country }),
    }

    try {
      if (contact === null) {
        await create({
          ...input,
          ...(lastName.trim() === '' ? {} : { lastName: lastName.trim() }),
          ...(email.trim() === '' ? {} : { email: email.trim() }),
        }).unwrap()
        toast.success(i18n._(msg`Contacto creado.`))
      } else {
        // Al editar, vaciar el apellido o el email los borra.
        await update({
          id: contact.id,
          body: {
            ...input,
            lastName: lastName.trim() === '' ? null : lastName.trim(),
            email: email.trim() === '' ? null : email.trim(),
          },
        }).unwrap()
        toast.success(i18n._(msg`Contacto actualizado.`))
      }
      onClose()
    } catch (caught) {
      setError(apiErrorMessage(caught, { fallback: i18n._(msg`No se pudo guardar el contacto.`) }))
    }
  }

  const formId = `${ids}-form`

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={contact === null ? i18n._(msg`Nuevo contacto`) : i18n._(msg`Editar contacto`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={isSaving}>
            {contact === null ? <Trans>Crear</Trans> : <Trans>Guardar</Trans>}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={i18n._(msg`Nombre *`)} htmlFor={`${ids}-first`}>
            <Input
              id={`${ids}-first`}
              required
              maxLength={100}
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value)
              }}
            />
          </FormField>
          <FormField label={i18n._(msg`Apellido`)} htmlFor={`${ids}-last`}>
            <Input
              id={`${ids}-last`}
              maxLength={100}
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value)
              }}
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <FormField
            label={i18n._(msg`Teléfono *`)}
            htmlFor={`${ids}-phone`}
            hint={i18n._(msg`Con lada de país (+52…) o elige el país al lado.`)}
          >
            <Input
              id={`${ids}-phone`}
              type="tel"
              required
              maxLength={30}
              placeholder="+52 55 1234 5678"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
              }}
            />
          </FormField>
          <FormField label={i18n._(msg`País`)} htmlFor={`${ids}-country`}>
            <Input
              id={`${ids}-country`}
              maxLength={2}
              placeholder="MX"
              value={countryCode}
              onChange={(event) => {
                setCountryCode(event.target.value.toUpperCase())
              }}
            />
          </FormField>
        </div>

        <FormField label={i18n._(msg`Email`)} htmlFor={`${ids}-email`}>
          <Input
            id={`${ids}-email`}
            type="email"
            maxLength={200}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
          />
        </FormField>

        <FormField label={i18n._(msg`Etiquetas`)}>
          {tags.length === 0 ? (
            <p className="text-sm text-ink-3">
              <Trans>Todavía no hay etiquetas en la plataforma de mensajería.</Trans>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      toggleTag(tag.id)
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected ? 'border-o-500 bg-o-50 text-o-700' : 'border-line text-ink-2'
                    }`}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-sm text-st-rojo">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

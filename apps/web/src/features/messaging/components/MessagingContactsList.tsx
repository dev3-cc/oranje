import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Input } from '@oranje/ui'
import { useState, type FormEvent, type ReactNode } from 'react'

import { useGetMessagingContactsQuery, type MessagingContact } from '../api/messagingApi'

import { ContactRowActions, NewContactButton } from './ContactActions'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'
import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Los Contactos de la plataforma de mensajería, como su propia pantalla:
 * total, buscador, tabla y páginas de 20. Crear, editar, dar de baja y eliminar
 * viven en `ContactActions`; importar desde Excel no va por ahora (Hugo, 2026-10-23).
 */
export function MessagingContactsList(): ReactNode {
  const { i18n } = useLingui()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, isError, error, refetch } = useGetMessagingContactsQuery({
    page,
    search,
  })

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    setSearch(draft.trim())
    setPage(1)
  }

  if (isError) {
    return (
      <LoadError
        message={apiErrorMessage(error, {
          fallback: i18n._(msg`No se pudieron cargar los contactos.`),
        })}
        onRetry={(): void => void refetch()}
      />
    )
  }

  if (data?.configured === false) {
    return (
      <NoticeCard
        tone="warning"
        image={personajeConfiguracion}
        title={i18n._(msg`Este ambiente no está conectado a la plataforma de mensajería`)}
      >
        <Trans>
          Faltan las variables MESSAGING_API_* en el API. Cuando se configuren, aquí aparecen los
          contactos.
        </Trans>
      </NoticeCard>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            <Trans>Contactos</Trans>
          </h2>
          {data?.configured === true && (
            <p className="text-sm text-ink-3">
              <Trans>{data.pagination.total} en total</Trans>
            </p>
          )}
        </div>

        <form onSubmit={submit} role="search" className="flex w-full gap-2 sm:w-auto">
          <Input
            type="search"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            placeholder={i18n._(msg`Buscar por nombre, teléfono o email…`)}
            aria-label={i18n._(msg`Buscar contactos`)}
            className="sm:w-80"
          />
          <Button type="submit" variant="secondary">
            <Trans>Buscar</Trans>
          </Button>
        </form>
        {data?.configured === true && <NewContactButton />}
      </div>

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-3" />
      ) : data.contacts.length === 0 ? (
        <NoticeCard
          image={personajeSinResultados}
          title={search === '' ? i18n._(msg`Sin contactos`) : i18n._(msg`Nadie coincide`)}
        >
          {search === '' ? (
            <Trans>Todavía no hay contactos en la plataforma de mensajería.</Trans>
          ) : (
            <Trans>Ningún contacto coincide con «{search}».</Trans>
          )}
        </NoticeCard>
      ) : (
        <>
          <ContactsTable rows={data.contacts} dimmed={isFetching} />
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-3">
              <Button
                variant="secondary"
                disabled={page <= 1 || isFetching}
                onClick={() => {
                  setPage(page - 1)
                }}
              >
                <Trans>Anterior</Trans>
              </Button>
              <span>
                <Trans>
                  Página {data.pagination.page} de {data.pagination.totalPages}
                </Trans>
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.pagination.totalPages || isFetching}
                onClick={() => {
                  setPage(page + 1)
                }}
              >
                <Trans>Siguiente</Trans>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ContactsTable({ rows, dimmed }: { rows: MessagingContact[]; dimmed: boolean }): ReactNode {
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-line bg-surface transition-opacity ${dimmed ? 'opacity-60' : ''}`}
    >
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="px-4 py-3 font-semibold">
              <Trans>Nombre</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Teléfono</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Etiquetas</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Estado</Trans>
            </th>
            <th className="px-4 py-3">
              <span className="sr-only">
                <Trans>Acciones</Trans>
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((contact) => (
            <tr key={contact.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-ink">
                  {contact.lastName === null
                    ? contact.firstName
                    : `${contact.firstName} ${contact.lastName}`}
                </p>
                {contact.email !== null && <p className="text-xs text-ink-3">{contact.email}</p>}
              </td>
              <td className="px-4 py-3 text-ink-2 tabular-nums">+{contact.phone}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${tag.color === null ? 'bg-surface-2 text-ink-2' : ''}`}
                      /* El color lo elige quien crea la etiqueta en la plataforma. */
                      style={
                        tag.color === null
                          ? undefined
                          : { backgroundColor: `${tag.color}22`, color: tag.color }
                      }
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                {contact.optedOut ? (
                  <span className="inline-flex rounded-full bg-st-rojo/10 px-2.5 py-0.5 text-xs font-semibold text-st-rojo">
                    <Trans>Dado de baja</Trans>
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-st-verde/15 px-2.5 py-0.5 text-xs font-semibold text-st-verde">
                    <Trans>Activo</Trans>
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <ContactRowActions contact={contact} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

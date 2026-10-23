import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { Input, MaterialIcon } from '@oranje/ui'
import { useState, type FormEvent, type ReactNode } from 'react'

import { useGetMessagingWorkersQuery } from '../api/messagingWorkersApi'
import { useGetMessagingAssignedHotelsQuery } from '../api/messagingWorkersApi'

import { ANY_FILTER, MessagingFilters, type FilterOption } from './MessagingFilters'

import personajeAccesoProtegido from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'
import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  WORKER_STATUSES,
  WORKER_STATUS_TOKEN,
  workerStatusChipLabel,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatPhone } from '@/shared/lib/formatters'
import type { WorkerApi } from '@/shared/types/apiContract.types'

/**
 * Los doce semáforos, con la etiqueta en palabras del chip (nunca el color).
 * Función y no constante: la etiqueta se traduce al leerla, y una constante
 * se quedaría en el idioma con el que cargó el módulo.
 */
function workerStatusOptions(): FilterOption[] {
  return WORKER_STATUSES.map((code) => ({ value: code, label: workerStatusChipLabel(code) }))
}

/**
 * El listado de colaboradores dentro de Mensajería › Contactos: nombre,
 * teléfono, semáforo y dónde trabaja hoy. El teléfono y el semáforo solo
 * llegan en la ficha completa (Reclutamiento, QA); para los demás roles que
 * pueden listar, la celda queda en «—».
 */
export function MessagingWorkersList(): ReactNode {
  const { i18n } = useLingui()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(ANY_FILTER)
  const [hotel, setHotel] = useState(ANY_FILTER)
  const { data, isLoading, isFetching, isError, error, refetch } = useGetMessagingWorkersQuery({
    page,
    search,
    state: status === ANY_FILTER ? '' : status,
    hotelId: hotel === ANY_FILTER ? '' : hotel,
  })
  // Si las opciones fallan, el listado sigue: solo se queda sin filtro por hotel.
  const { data: hotels } = useGetMessagingAssignedHotelsQuery()
  const isFiltered = search !== '' || status !== ANY_FILTER || hotel !== ANY_FILTER

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    setSearch(draft.trim())
    setPage(1)
  }

  // Un 403 no se arregla reintentando: es el rol, y se dice así.
  const forbidden =
    isError && typeof error === 'object' && 'status' in error && error.status === 403

  if (forbidden) {
    return (
      <NoticeCard
        image={personajeAccesoProtegido}
        title={i18n._(msg`Tu rol no puede ver el listado de colaboradores`)}
      >
        <Trans>
          Lo ven Reclutamiento, el Manager de QA, Contabilidad y los roles del hotel (solo su
          personal).
        </Trans>
      </NoticeCard>
    )
  }

  if (isError) {
    return (
      <LoadError
        message={apiErrorMessage(error, {
          fallback: i18n._(msg`No se pudieron cargar los colaboradores.`),
        })}
        onRetry={(): void => void refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            <Trans>Colaboradores</Trans>
          </h2>
          {data && (
            <p className="text-sm text-ink-3">
              <Trans>{data.meta.total} en total</Trans>
            </p>
          )}
        </div>

        <form onSubmit={submit} role="search" className="flex w-full gap-2 sm:w-auto">
          {/* El Input base es transparente y su borde casi no se ve sobre el
              beige del fondo (Hugo, 2026-10-23): aquí va en blanco, con borde
              marcado y la lupa dentro, como el SearchField de la casa. */}
          <div className="relative flex-1 sm:w-80 sm:flex-none">
            <MaterialIcon
              name="search"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg text-ink-3"
            />
            <Input
              type="search"
              autoComplete="off"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
              }}
              placeholder={i18n._(msg`Buscar por nombre…`)}
              aria-label={i18n._(msg`Buscar colaboradores`)}
              className="h-10 border-ink-4/60 bg-surface pl-10 shadow-sm"
            />
          </div>
          <Button type="submit" variant="primary" className="h-10">
            <Trans>Buscar</Trans>
          </Button>
        </form>
      </div>

      <MessagingFilters
        {...(hotels !== undefined && hotels.length > 0
          ? {
              hotel: {
                value: hotel,
                options: hotels.map(({ id, name }) => ({ value: id, label: name })),
                onChange: (value: string) => {
                  setHotel(value)
                  setPage(1)
                },
              },
            }
          : {})}
        status={{
          value: status,
          options: workerStatusOptions(),
          onChange: (value) => {
            setStatus(value)
            setPage(1)
          },
        }}
      />

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-3" />
      ) : data.data.length === 0 ? (
        <NoticeCard
          image={personajeSinResultados}
          title={isFiltered ? i18n._(msg`Nadie coincide`) : i18n._(msg`Sin colaboradores`)}
        >
          {!isFiltered ? (
            <Trans>Todavía no hay colaboradores que puedas ver.</Trans>
          ) : search === '' ? (
            <Trans>Ningún colaborador está en ese estado.</Trans>
          ) : (
            <Trans>Ningún colaborador coincide con «{search}».</Trans>
          )}
        </NoticeCard>
      ) : (
        <>
          <WorkersTable rows={data.data} dimmed={isFetching} />
          {data.meta.totalPages > 1 && (
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
                  Página {data.meta.page} de {data.meta.totalPages}
                </Trans>
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.meta.totalPages || isFetching}
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

/** Un semáforo que el front no conoce se muestra como «—», no rompe la fila. */
function isWorkerStatus(code: string): code is WorkerStatus {
  return (WORKER_STATUSES as readonly string[]).includes(code)
}

function WorkersTable({ rows, dimmed }: { rows: WorkerApi[]; dimmed: boolean }): ReactNode {
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
              <Trans>Estado</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Hotel</Trans>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((worker) => {
            const phone = formatPhone(worker.phone)
            return (
              <tr key={worker.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{worker.fullName}</p>
                  {worker.email != null && <p className="text-xs text-ink-3">{worker.email}</p>}
                </td>
                <td className="px-4 py-3 text-ink-2 tabular-nums">
                  {phone === '' ? <span className="text-ink-3">—</span> : phone}
                </td>
                <td className="px-4 py-3">
                  {worker.state !== undefined && isWorkerStatus(worker.state.code) ? (
                    <StatusLightSoftBadge
                      token={WORKER_STATUS_TOKEN[worker.state.code]}
                      label={workerStatusChipLabel(worker.state.code)}
                    />
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {worker.assignment === null ? (
                    <span className="text-ink-3">
                      <Trans>Sin asignación</Trans>
                    </span>
                  ) : (
                    worker.assignment.hotelName
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

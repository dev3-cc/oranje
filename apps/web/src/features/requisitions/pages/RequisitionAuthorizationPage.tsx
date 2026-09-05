import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetAuthorizationQueueQuery } from '../api/authorizationsApi'
import { AuthorizationPositionsTable } from '../components/AuthorizationPositionsTable'
import { AuthorizationQueueList } from '../components/AuthorizationQueueList'
import { AuthorizationResolutionForm } from '../components/AuthorizationResolutionForm'

import personajeManager from '@/assets/ilustrations/personaje-manager.svg'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  AUTHORIZATION_TRANSITION,
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { useCan } from '@/shared/hooks/useCan'
import { matchesSearch } from '@/shared/lib/text'

/**
 * Cola de autorización: lo que espera la firma del Manager.
 *
 * El subtítulo nombra el salto del semáforo leyéndolo de las constantes y no a
 * mano. Es a propósito: la maqueta dice que autorizar mueve «Azul claro → Verde
 * manzana», y §5 dice que mueve «En elaboración → Autorizada». Mientras eso se
 * aclara, la pantalla dice lo que digan las constantes y se corrige sola.
 */
export function RequisitionAuthorizationPage(): ReactNode {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Por folio u hotel, EN MEMORIA: la cola ya está cargada entera. */
  const [search, setSearch] = useState('')
  const can = useCan()
  /** Firmar es de los Managers (requisitions:authorize); los demás solo consultan la cola. */
  const canAuthorize = can('requisitions:authorize')

  const { data: queue, isLoading, isError, refetch } = useGetAuthorizationQueueQuery()

  if (isLoading) {
    return <TableSkeleton rows={4} columns={4} />
  }

  if (isError || !queue) {
    return (
      <div className="flex flex-col gap-4">
        <LoadError
          message="No se pudo cargar la cola de autorización. Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => {
            void refetch()
          }}
        />
        <Link to="/requisiciones" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al Tablero de Requisiciones
        </Link>
      </div>
    )
  }

  const visibleItems = queue.items.filter((item) =>
    matchesSearch(search, item.number, item.hotelName),
  )
  const isFilteredOut = queue.items.length > 0 && visibleItems.length === 0

  // Al firmar, la requisición sale de la cola y la selección cae sola en la
  // siguiente: quien autoriza no tiene que volver a apuntar con el ratón. Y
  // sale de lo VISIBLE: si la búsqueda deja fuera a la elegida, el panel pasa
  // a la primera que sí se ve.
  const selected = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0]

  const fromLabel = REQUISITION_STATUS_LABEL[AUTHORIZATION_TRANSITION.from]
  const toLabel = REQUISITION_STATUS_LABEL[AUTHORIZATION_TRANSITION.to]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/requisiciones" className="hover:text-o-700">
          Demanda
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">Autorización de Requisición</span>
      </nav>

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Requisiciones por autorizar</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {queue.items.length === 1
            ? `1 espera ${canAuthorize ? 'tu firma' : 'la firma del Manager'}`
            : `${String(queue.items.length)} esperan ${canAuthorize ? 'tu firma' : 'la firma del Manager'}`}
          . Autorizar mueve {fromLabel} → {toLabel} y arranca el reloj de la urgencia
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-4">
          {queue.items.length > 0 && (
            <SearchField
              value={search}
              onChange={setSearch}
              label="Buscar pendiente"
              placeholder="Folio o hotel, p. ej. Puerto Real…"
            />
          )}
          <AuthorizationQueueList
            items={visibleItems}
            selectedId={selected?.id ?? ''}
            onSelect={setSelectedId}
            {...(isFilteredOut
              ? {
                  emptyMessage: `Ninguna pendiente coincide con «${search.trim()}». Cambia la búsqueda o límpiala para ver toda la cola.`,
                }
              : {})}
          />
        </div>

        {selected ? (
          <div className="flex flex-col gap-6 xl:col-span-2">
            <section className="rounded-lg border border-line bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 p-6">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight text-ink">{selected.number}</h2>
                  <p className="mt-1 text-sm text-ink-3">
                    {selected.hotelName} · {selected.department} · solicitada por{' '}
                    {selected.requestedByName}
                  </p>
                </div>
                <StatusLightSoftBadge
                  token={REQUISITION_STATUS_TOKEN[selected.status]}
                  label={REQUISITION_STATUS_LABEL[selected.status]}
                />
              </div>

              <div className="border-t border-line">
                <AuthorizationPositionsTable positions={selected.positions} />
              </div>
            </section>

            {canAuthorize ? (
              <AuthorizationResolutionForm
                request={selected}
                authorizerRole={queue.authorizerRole}
                authorizerScope={queue.authorizerScope}
              />
            ) : (
              <NoticeCard image={personajeManager} title="La firma es del Manager" role="status">
                Autorizar es del Manager de Área o del Manager General: cuando firmen, la
                requisición pasa a Autorizada y Reclutamiento la ve en la Bolsa del Self-Pick.
              </NoticeCard>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-ink-3 xl:col-span-2">
            {isFilteredOut
              ? 'Ninguna pendiente coincide con la búsqueda: cambia el folio o el hotel, o límpiala.'
              : 'No hay requisiciones por autorizar. Cuando un Supervisor cree una, aparecerá aquí.'}
          </p>
        )}
      </div>
    </div>
  )
}

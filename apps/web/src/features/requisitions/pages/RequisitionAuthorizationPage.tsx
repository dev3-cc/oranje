import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetAuthorizationQueueQuery } from '../api/authorizationsApi'
import { AuthorizationPositionsTable } from '../components/AuthorizationPositionsTable'
import { AuthorizationQueueList } from '../components/AuthorizationQueueList'
import { AuthorizationResolutionForm } from '../components/AuthorizationResolutionForm'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  AUTHORIZATION_TRANSITION,
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
} from '@/shared/constants/requisitionStatus'

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

  const { data: queue, isLoading, isError } = useGetAuthorizationQueueQuery()

  if (isLoading) {
    return <TableSkeleton rows={4} columns={4} />
  }

  if (isError || !queue) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">No se pudo cargar la cola de autorización.</p>
        <Link to="/requisiciones" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al tablero
        </Link>
      </div>
    )
  }

  // Al firmar, la requisición sale de la cola y la selección cae sola en la
  // siguiente: quien autoriza no tiene que volver a apuntar con el ratón.
  const selected = queue.items.find((item) => item.id === selectedId) ?? queue.items[0]

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
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Autorización de requisiciones
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {queue.items.length === 1
            ? '1 espera tu firma'
            : `${String(queue.items.length)} esperan tu firma`}
          . Autorizar mueve {fromLabel} → {toLabel} y arranca el reloj de la urgencia
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <AuthorizationQueueList
          items={queue.items}
          selectedId={selected?.id ?? ''}
          onSelect={setSelectedId}
        />

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

            <AuthorizationResolutionForm
              request={selected}
              authorizerRole={queue.authorizerRole}
              authorizerScope={queue.authorizerScope}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-ink-3 xl:col-span-2">
            Nada pendiente. Todo lo que llegó ya se resolvió.
          </p>
        )}
      </div>
    </div>
  )
}

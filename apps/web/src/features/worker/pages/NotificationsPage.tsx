import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetMyNotificationsQuery, useMarkNotificationReadMutation } from '../api/workerApi'
import { WorkerSkeleton } from '../components/WorkerSkeleton'

import personajeErrorTecnico from '@/assets/ilustrations/personaje-error-tecnico.svg'
import personajeNotificaciones from '@/assets/ilustrations/personaje-notificaciones.svg'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/**
 * Avisos del Colaborador (RF-C-09): una fila por destinatario, del modelo de
 * Notificaciones — no leída mientras `read_at` sea nulo; tocarla la marca.
 * El push por FCM (plataforma WEB incluida) llega aparte; esta lista es el
 * historial.
 */
export function NotificationsPage(): ReactNode {
  const { data: board, isLoading, isError } = useGetMyNotificationsQuery()
  const [markRead] = useMarkNotificationReadMutation()
  const notifications = board?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">Avisos</h1>
        <p className="mt-1 text-xs text-ink-3">
          Tocar un aviso lo marca como leído; los leídos se limpian a los 30 días
        </p>
      </header>

      {isError && (
        <div className="flex flex-col items-center gap-2 rounded-md bg-surface-2 px-4 py-6 text-center">
          <img src={personajeErrorTecnico} alt="" aria-hidden className="h-28 w-auto" />
          <p className="text-sm text-ink-2">
            Tus avisos llegarán aquí en cuanto el servicio de notificaciones esté activo.
          </p>
        </div>
      )}

      {isLoading && notifications.length === 0 && <WorkerSkeleton variant="list" />}

      {!isLoading && !isError && notifications.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-8 text-center">
          <img src={personajeNotificaciones} alt="" aria-hidden className="h-28 w-auto" />
          <p className="text-sm text-ink-3">Sin avisos por ahora.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {notifications.map((notification) => {
          const isUnread = notification.readAt === null
          return (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => {
                  if (isUnread) void markRead(notification.id)
                }}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-colors',
                  isUnread
                    ? 'cursor-pointer border-o-500/40 bg-o-50/60 hover:bg-o-50'
                    : 'cursor-default border-line bg-surface',
                )}
              >
                <p className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'text-sm',
                      isUnread ? 'font-bold text-ink' : 'font-medium text-ink-2',
                    )}
                  >
                    {isUnread && (
                      <span
                        aria-label="No leído"
                        className="mr-1.5 inline-block size-2 rounded-full bg-o-500"
                      />
                    )}
                    {notification.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-4">
                    {formatDayMonthTime(notification.createdAt)}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-3">{notification.body}</p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

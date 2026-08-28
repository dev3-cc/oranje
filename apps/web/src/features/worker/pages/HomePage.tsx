import { StatusLightBadge } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import {
  useGetMyNotificationsQuery,
  useGetMyProfileQuery,
  useSetAvailableMutation,
} from '../api/workerApi'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'

import mascotaFeliz from '@/assets/mascota/mascota-feliz.png'
import mascotaSaludando from '@/assets/mascota/mascota-saludando.png'
import { Button } from '@/shared/components/Button'
import { LoadingState } from '@/shared/components/LoadingState'
import {
  workerStatusChipLabel,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** Los tres orígenes desde donde el semáforo deja encender Amarillo (seed). */
const CAN_GO_AVAILABLE: ReadonlySet<string> = new Set(['STRONG_GREEN', 'ORANGE', 'PINK'])

/**
 * Inicio del Colaborador (maqueta «Inicio con mascota»): saludo, su estado
 * del semáforo en palabras, el plazo del SSN/ITIN si corre, lo que le falta
 * del expediente, y el botón de disponibilidad (Amarillo). El ponche llegará
 * aquí cuando se decida su mecanismo web.
 */
export function HomePage(): ReactNode {
  const { data: profile, isLoading } = useGetMyProfileQuery()
  const { data: board } = useGetMyNotificationsQuery()
  const [setAvailable, { isLoading: isSwitching, isError, error }] = useSetAvailableMutation()

  if (isLoading || !profile) return <LoadingState label="Abriendo tu inicio…" />

  const status = profile.state.code as WorkerStatus
  const firstName = profile.fullName.split(/\s+/)[0] ?? profile.fullName
  const isAvailable = status === 'YELLOW'
  const unread = board?.unread ?? 0

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-4">
        <img
          src={isAvailable ? mascotaFeliz : mascotaSaludando}
          alt=""
          aria-hidden
          className="h-24 w-auto"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Hola, {firstName}</h1>
          <div className="mt-1.5">
            <StatusLightBadge
              token={WORKER_STATUS_TOKEN[status]}
              label={workerStatusChipLabel(status)}
            />
          </div>
        </div>
      </section>

      <TaxDeadlineBanner deadline={profile.taxDeadline} />

      {!profile.isProfileComplete && (
        <section className="rounded-xl border border-dashed border-o-500/60 bg-o-50 p-4">
          <p className="text-sm font-semibold text-ink">Tu expediente está incompleto</p>
          <p className="mt-1 text-sm text-ink-2">
            Termina las fases 2 y 3 para que Reclutamiento pueda validarte y entres al Pool.
          </p>
          <Link
            to="/colaborador/alta-2"
            className="mt-3 inline-flex rounded-md bg-o-500 px-4 py-2 text-sm font-semibold text-ink"
          >
            Completar mi expediente
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Disponibilidad</p>
        {isAvailable ? (
          <p className="mt-1 text-sm text-ink-2">
            Estás <strong>disponible por voluntad propia</strong>: Reclutamiento puede asignarte en
            cuanto haya una requisición. Salir de Amarillo lo decide la asignación o Reclutamiento,
            no un botón.
          </p>
        ) : CAN_GO_AVAILABLE.has(status) ? (
          <>
            <p className="mt-1 text-sm text-ink-2">
              Enciende Amarillo cuando quieras que te consideren para más turnos.
            </p>
            <Button
              variant="primary"
              className="mt-3"
              disabled={isSwitching}
              onClick={() => {
                void setAvailable()
              }}
            >
              {isSwitching ? 'Un momento…' : 'Marcarme disponible'}
            </Button>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-3">
            Desde tu estado actual no se enciende la disponibilidad — la maneja Reclutamiento.
          </p>
        )}
        {isError && (
          <p role="alert" className="mt-2 text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                TRANSITION_NOT_ALLOWED: 'Tu semáforo no permite encender Amarillo desde aquí.',
              },
              fallback: 'No se pudo cambiar tu disponibilidad. Inténtalo de nuevo.',
            })}
          </p>
        )}
      </section>

      <Link
        to="/colaborador/avisos"
        className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        Avisos
        <span className="rounded-full bg-o-500/15 px-2.5 py-0.5 text-xs font-bold text-o-700">
          {unread > 0 ? `${String(unread)} sin leer` : 'al día'}
        </span>
      </Link>
    </div>
  )
}

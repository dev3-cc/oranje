import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { AccessDeadlinesApi } from '../types/worker.types'

import { ChangePasswordForm } from './ChangePasswordForm'

import personajeAccesoProtegido from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import personajeSubiendo from '@/assets/ilustrations/personaje-subiendo.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { formatDate } from '@/shared/lib/formatters'

const ACTION_LINK =
  'inline-flex min-h-11 touch-manipulation items-center rounded-md bg-o-300 shadow-xs px-4 text-sm font-semibold text-ink transition-colors hover:bg-o-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-700'

/**
 * Los dos plazos que corren desde que te dieron acceso (Reglas de Negocio §
 * Acceso del Colaborador y § Validación con expediente incompleto):
 * recordatorio mientras corren. Vencidos no se pintan aquí: el shell bloquea
 * el apartado entero con la salida a la mano.
 *
 * La contraseña son 30 días (Hugo, 2026-09-22, antes 3 — muchos colaboradores
 * comparten hoy Oranje.2026 y necesitan más margen). El expediente sigue en 3.
 */
export function AccessDeadlineBanner({ deadlines }: { deadlines: AccessDeadlinesApi }): ReactNode {
  const { t } = useLingui()
  const { password, profile } = deadlines

  return (
    <>
      {password.status === 'PENDING' && password.dueAt && (
        <NoticeCard
          image={personajeAccesoProtegido}
          title={t`Cambia tu contraseña`}
          tone="action"
          role="status"
          action={
            <Link to="/collaborator/password" className={ACTION_LINK}>
              <Trans>Cambiar contraseña</Trans>
            </Link>
          }
        >
          <Trans>
            La que te dieron es temporal. Tienes hasta el{' '}
            <span className="font-semibold">{formatDate(password.dueAt)}</span> (día{' '}
            {password.day ?? 1} de 30); después tu acceso se bloquea hasta que la cambies.
          </Trans>
        </NoticeCard>
      )}

      {profile.status === 'PENDING' && profile.dueAt && (
        <NoticeCard
          image={personajeSubiendo}
          title={t`Completa tus datos`}
          tone="action"
          role="status"
          action={
            <Link to="/collaborator/signup-2" className={ACTION_LINK}>
              <Trans>Completar mis datos</Trans>
            </Link>
          }
        >
          <Trans>
            Reclutamiento ya te validó con tu expediente a medias. Tienes hasta el{' '}
            <span className="font-semibold">{formatDate(profile.dueAt)}</span> (día{' '}
            {profile.day ?? 1} de 3); después tu acceso se bloquea hasta que lo completes.
          </Trans>
        </NoticeCard>
      )}
    </>
  )
}

/** Plazo de la contraseña vencido: el acceso vuelve al instante al cambiarla. */
export function PasswordOverdueScreen(): ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-6 text-center">
      <img src={personajeAccesoProtegido} alt="" aria-hidden className="h-36 w-auto" />
      <h1 className="text-xl font-bold text-ink">
        <Trans>Cambia tu contraseña para seguir</Trans>
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-3">
        <Trans>
          Pasaron los 30 días para cambiar la contraseña temporal que te dieron. Elige la tuya aquí
          y tu acceso vuelve al instante — tus datos y tu historial no se pierden.
        </Trans>
      </p>
      <div className="w-full text-left">
        <ChangePasswordForm />
      </div>
    </div>
  )
}

/** Plazo del expediente vencido: la salida es completar los datos, no una llamada. */
export function ProfileOverdueScreen(): ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <img src={personajeSubiendo} alt="" aria-hidden className="h-36 w-auto" />
      <h1 className="text-xl font-bold text-ink">
        <Trans>Completa tus datos para seguir</Trans>
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-3">
        <Trans>
          Pasaron los 3 días para completar tu expediente después de que Reclutamiento te validó.
          Llénalo aquí y tu acceso vuelve al instante — tus datos y tu historial no se pierden.
        </Trans>
      </p>
      <Link to="/collaborator/signup-2" className={ACTION_LINK}>
        <Trans>Completar mis datos</Trans>
      </Link>
    </div>
  )
}

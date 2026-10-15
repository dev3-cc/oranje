import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { homePathFor, UNSUPPORTED_HOME } from './roles'

import { useAppSelector } from '@/app/hooks'
import { useLogoutMutation } from '@/app/sessionApi'
import { selectSessionUser } from '@/app/sessionSlice'
import personajeAccesoProtegido from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { Button } from '@/shared/components/Button'
import { roleLabelOf } from '@/shared/constants/roles'

/**
 * Para el staff de Oranje que entra a la app: su trabajo vive en el web. Se le
 * dice en palabras y se le deja cerrar sesión — sin esto rebotaba entre `/` y
 * `/collaborator` sin fin.
 */
export function UnsupportedRolePage(): ReactNode {
  const { t } = useLingui()
  const user = useAppSelector(selectSessionUser)
  const [logout, { isLoading }] = useLogoutMutation()

  /* Si el rol sí tiene apartado (p. ej. llegó aquí por un enlace viejo), va a él. */
  const home = homePathFor(user?.roleId)
  if (home !== UNSUPPORTED_HOME) return <Navigate to={home} replace />

  const role = roleLabelOf(user?.roleId ?? '')

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center gap-6 bg-surface px-6 text-center">
      <img src={personajeAccesoProtegido} alt="" aria-hidden className="h-40 w-auto" />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-ink">
          <Trans>Esta app es para colaboradores y hoteles</Trans>
        </h1>
        <p className="text-sm text-ink-2">
          <Trans>
            Entraste como {role.title}. Tu trabajo en Oranje está en el web, desde la computadora.
          </Trans>
        </p>
      </div>
      <Button
        variant="primary"
        className="min-h-12 w-full max-w-xs"
        disabled={isLoading}
        onClick={() => {
          void logout()
        }}
      >
        {t`Cerrar sesión`}
      </Button>
    </main>
  )
}

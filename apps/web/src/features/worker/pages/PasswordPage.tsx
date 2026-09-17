import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { ChangePasswordForm } from '../components/ChangePasswordForm'

/** Cambiar mi contraseña, desde el menú de la cuenta. */
export function PasswordPage(): ReactNode {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">
          <Trans>Contraseña</Trans>
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          <Trans>Elige una que solo tú sepas; la temporal que te dieron deja de servir.</Trans>
        </p>
      </header>
      <ChangePasswordForm
        onChanged={() => {
          void navigate('/collaborator/profile')
        }}
      />
    </div>
  )
}

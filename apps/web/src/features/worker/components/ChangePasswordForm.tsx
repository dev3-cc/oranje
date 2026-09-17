import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useChangeMyPasswordMutation } from '../api/workerApi'

import { Button } from '@/shared/components/Button'
import { PasswordInput } from '@/shared/components/PasswordInput'
import { apiErrorMessage } from '@/shared/lib/apiError'

const MIN_LENGTH = 8

/**
 * La contraseña temporal que te dieron en mano se cambia aquí (Reglas de
 * Negocio § Acceso del Colaborador). El mismo formulario sirve en la pantalla
 * de Contraseña y en el interceptor de plazo vencido: cambiarla es lo que
 * levanta el bloqueo, así que la salida no puede vivir detrás de la puerta.
 */
export function ChangePasswordForm({ onChanged }: { onChanged?: () => void }): ReactNode {
  const { t } = useLingui()
  const [changePassword, { isLoading, isError, error }] = useChangeMyPasswordMutation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const isLongEnough = password.length >= MIN_LENGTH
  const matches = password === confirmation
  const canSubmit = isLongEnough && matches && !isLoading

  const hint = !isLongEnough
    ? t`Mínimo ${MIN_LENGTH} caracteres`
    : !matches
      ? t`Las dos contraseñas no coinciden`
      : null

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await changePassword({ newPassword: password }).unwrap()
      toast.success(t`Contraseña cambiada`)
      setPassword('')
      setConfirmation('')
      onChanged?.()
    } catch {
      return
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-3">
          <Trans>Contraseña nueva</Trans>
        </span>
        <PasswordInput
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
          autoComplete="new-password"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-3">
          <Trans>Repítela</Trans>
        </span>
        <PasswordInput
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value)
          }}
          autoComplete="new-password"
        />
      </label>

      {isError && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            fallback: t`No se pudo cambiar la contraseña. Inténtalo de nuevo.`,
          })}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">{hint}</span>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {isLoading ? t`Guardando…` : t`Cambiar contraseña`}
        </Button>
      </div>
      <p className="text-xs text-ink-4">
        <Trans>
          Es la contraseña con la que entras a esta app. La de tu correo corporativo se cambia desde
          el correo.
        </Trans>
      </p>
    </form>
  )
}

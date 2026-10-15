import { Trans } from '@lingui/react/macro'
import { Alert, AlertDescription } from '@oranje/ui'
import type { ReactNode } from 'react'

import { Button } from './Button'

import personajeErrorTecnico from '@/assets/ilustrations/personaje-error-tecnico.svg'

export function LoadError({
  message,
  onRetry,
}: {
  message: string
  /**
   * Sin esto no hay botón: reintentar solo sirve cuando el siguiente intento
   * puede salir distinto. Un 403 no cambia por volver a cargar, y ofrecerlo
   * manda a la persona a insistir contra una puerta cerrada (Hugo, 2026-10-09).
   */
  onRetry?: () => void
}): ReactNode {
  return (
    <Alert
      variant="destructive"
      className="flex flex-col items-center gap-3 border-line bg-surface p-8 text-center"
    >
      <img src={personajeErrorTecnico} alt="" aria-hidden className="h-32 w-auto" />
      <AlertDescription className="justify-items-center">{message}</AlertDescription>
      {onRetry !== undefined && (
        <Button variant="secondary" onClick={onRetry}>
          <Trans>Volver a cargar</Trans>
        </Button>
      )}
    </Alert>
  )
}

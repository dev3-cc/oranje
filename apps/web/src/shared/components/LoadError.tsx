import { Alert, AlertDescription } from '@oranje/ui'
import type { ReactNode } from 'react'

import { Button } from './Button'

import personajeErrorTecnico from '@/assets/ilustrations/personaje-error-tecnico.svg'

export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}): ReactNode {
  return (
    <Alert
      variant="destructive"
      className="flex flex-col items-center gap-3 border-line bg-surface p-8 text-center"
    >
      <img src={personajeErrorTecnico} alt="" aria-hidden className="h-32 w-auto" />
      <AlertDescription className="justify-items-center">{message}</AlertDescription>
      <Button variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </Alert>
  )
}

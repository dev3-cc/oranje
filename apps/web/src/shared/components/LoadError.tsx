import type { ReactNode } from 'react'

import { Button } from './Button'

import personajeErrorTecnico from '@/assets/ilustrations/personaje-error-tecnico.svg'

/**
 * Error de carga CON salida: el personaje técnico, la causa y el botón de
 * reintento — un error sin acción deja al usuario en un callejón (regla de
 * Feedback del sistema de UX). `onRetry` es el `refetch` de la query.
 */
export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-8 text-center">
      <img src={personajeErrorTecnico} alt="" aria-hidden className="h-32 w-auto" />
      <p className="text-sm text-red">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ConversionRequirement } from '../types/conversion.types'

import { Button } from '@/shared/components/Button'

/**
 * Un requisito de la conversión: cumplido o pendiente, con su evidencia.
 *
 * El pendiente se destaca en naranja y, si trae acción, la ofrece ahí mismo:
 * mandar al usuario a otra pantalla a resolver lo único que bloquea sería
 * hacerle perder el hilo.
 *
 * El estado NO se codifica solo con color: el círculo cambia de relleno a
 * contorno y el detalle dice en palabras qué falta.
 */
export function RequirementRow({
  requirement,
  onAct,
  isActing,
}: {
  requirement: ConversionRequirement
  onAct: () => void
  isActing: boolean
}): ReactNode {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg p-4',
        requirement.isMet ? 'bg-surface-2' : 'border-2 border-o-500 bg-o-50',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 size-4 shrink-0 rounded-full',
            requirement.isMet ? 'bg-green' : 'border-2 border-o-500',
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{requirement.label}</p>
          <p className="mt-0.5 text-sm text-ink-3">{requirement.detail}</p>
        </div>
      </div>

      {requirement.action && (
        <Button onClick={onAct} disabled={isActing}>
          {isActing ? 'Creando…' : requirement.action.label}
        </Button>
      )}
    </li>
  )
}

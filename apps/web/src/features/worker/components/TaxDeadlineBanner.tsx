import type { ReactNode } from 'react'

import type { TaxDeadlineApi } from '../types/worker.types'

import personajeHastaPronto from '@/assets/ilustrations/personaje-hasta-pronto.svg'
import { formatDate } from '@/shared/lib/formatters'

/**
 * El plazo de SSN/ITIN (Reglas del Colaborador § Plazo): recordatorio los
 * días 1-3, interceptor el día 4. La suspensión del día 5 no se pinta aquí:
 * el shell bloquea el apartado entero.
 */
export function TaxDeadlineBanner({ deadline }: { deadline: TaxDeadlineApi }): ReactNode {
  if (deadline.hasDocument) {
    return (
      <p className="rounded-md bg-green/10 px-4 py-3 text-sm text-ink-2">
        Tu SSN/ITIN está {deadline.isDocumentVerified ? 'verificado' : 'cargado, en verificación'}.
        {deadline.taxRetentionApplies &&
          ' La retención del 16% sigue activa hasta que quede verificado (reembolsable).'}
      </p>
    )
  }

  if (deadline.status === 'NOTICE') {
    return (
      <p
        role="alert"
        className="rounded-md border border-yellow bg-yellow/15 px-4 py-3 text-sm text-ink"
      >
        <span className="font-bold">Ya debiste cargar tu SSN o ITIN</span> — el plazo venció el{' '}
        {formatDate(deadline.dueAt)} (vas en el día {deadline.day}). Mañana se suspende tu acceso.
        La retención del 16% sigue activa (reembolsable).
      </p>
    )
  }

  return (
    <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">
      Tienes hasta el <span className="font-semibold">{formatDate(deadline.dueAt)}</span> para
      cargar tu SSN o ITIN (día {deadline.day} de 3). Sin él aplica la retención del 16%
      (reembolsable).
    </p>
  )
}

/** Día 5: el acceso se suspende — solo el acceso, tus datos no se pierden. */
export function SuspendedScreen(): ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <img src={personajeHastaPronto} alt="" aria-hidden className="h-36 w-auto" />
      <h1 className="text-xl font-bold text-ink">Tu acceso está suspendido</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-3">
        Pasaron 5 días sin cargar tu SSN o ITIN. Contacta a Oranje (Customer Service) para
        desbloquearlo — tus datos y tu historial no se pierden.
      </p>
    </div>
  )
}

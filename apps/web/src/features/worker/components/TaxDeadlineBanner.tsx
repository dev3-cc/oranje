import type { ReactNode } from 'react'

import type { TaxDeadlineApi } from '../types/worker.types'

import { TaxDocumentUploader } from './TaxDocumentUploader'

import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajeHastaPronto from '@/assets/ilustrations/personaje-hasta-pronto.svg'
import personajePagoProcesado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajeUrgente from '@/assets/ilustrations/personaje-urgente.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { formatDate } from '@/shared/lib/formatters'

/**
 * El plazo de SSN/ITIN (Reglas del Colaborador § Plazo): recordatorio los
 * días 1-3, interceptor el día 4. La suspensión del día 5 no se pinta aquí:
 * el shell bloquea el apartado entero.
 */
export function TaxDeadlineBanner({ deadline }: { deadline: TaxDeadlineApi }): ReactNode {
  if (deadline.hasDocument) {
    return (
      <NoticeCard image={personajePagoProcesado} title="SSN/ITIN recibido" role="status">
        Tu SSN/ITIN está {deadline.isDocumentVerified ? 'verificado' : 'cargado, en verificación'}.
        {!deadline.isDocumentVerified && ' Cuando Oranje lo verifique, tu pago queda habilitado.'}
      </NoticeCard>
    )
  }

  if (deadline.status === 'NOTICE') {
    return (
      <NoticeCard
        image={personajeUrgente}
        title="Ya debiste cargar tu SSN o ITIN"
        tone="warning"
        role="alert"
      >
        El plazo venció el {formatDate(deadline.dueAt)} (vas en el día {deadline.day}). Mañana se
        suspende tu acceso, y sin tu SSN o ITIN no se te puede pagar.
      </NoticeCard>
    )
  }

  return (
    <NoticeCard image={personajeCronograma} title="Carga tu SSN o ITIN" role="status">
      Tienes hasta el <span className="font-semibold">{formatDate(deadline.dueAt)}</span> (día{' '}
      {deadline.day} de 3). Sin él no se te puede pagar.
    </NoticeCard>
  )
}

/**
 * Día 5: el acceso se suspende — solo el acceso, tus datos no se pierden. La
 * salida está AQUÍ: subir el documento levanta la suspensión al instante
 * (D-33); Customer Service es el camino si no puedes subirlo.
 */
export function SuspendedScreen(): ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <img src={personajeHastaPronto} alt="" aria-hidden className="h-36 w-auto" />
      <h1 className="text-xl font-bold text-ink">Tu acceso está suspendido</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-3">
        Pasaron 5 días sin cargar tu SSN o ITIN. Súbelo aquí y tu acceso vuelve al instante — tus
        datos y tu historial no se pierden. Si no puedes subirlo, contacta a Oranje (Customer
        Service).
      </p>
      <TaxDocumentUploader hasDocument={false} />
    </div>
  )
}

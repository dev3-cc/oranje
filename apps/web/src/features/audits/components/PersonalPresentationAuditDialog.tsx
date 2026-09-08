import type { ReactNode } from 'react'

import { AuditFormDialog } from './AuditFormDialog'

/**
 * Presentación Personal: por colaborador, en Uniformidad/Higiene/Seguridad/
 * Actitud. Con `auditId` reabre una ya guardada para corregirla (PATCH); sin
 * él, crea una nueva (POST) — mismo formulario, misma pantalla.
 */
export function PersonalPresentationAuditDialog({
  hotelId,
  worker,
  auditId,
  onClose,
  onSaved,
}: {
  hotelId: string
  worker: { id: string; fullName: string; photoUrl: string | null }
  auditId?: string
  onClose: () => void
  onSaved?: () => void
}): ReactNode {
  return (
    <AuditFormDialog
      auditType="PERSONAL_PRESENTATION"
      hotelId={hotelId}
      worker={worker}
      title="Auditoría de Presentación Personal"
      description={
        auditId
          ? 'Corrige lo que haga falta: se guarda con PATCH, sobre la misma auditoría.'
          : 'Uniformidad, higiene, seguridad y actitud del colaborador, reactivo por reactivo.'
      }
      {...(auditId ? { auditId } : {})}
      onClose={onClose}
      {...(onSaved ? { onSaved } : {})}
    />
  )
}

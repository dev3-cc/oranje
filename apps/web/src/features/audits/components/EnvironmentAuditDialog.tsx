import type { ReactNode } from 'react'

import { AuditFormDialog } from './AuditFormDialog'

/**
 * Percepción de Ambiente y Recursos: por HOTEL completo (sin elegir
 * colaborador), en Insumos/Relaciones/Carga laboral/Entorno. Con `auditId`
 * reabre una ya guardada para corregirla (PATCH).
 */
export function EnvironmentAuditDialog({
  hotelId,
  hotelName,
  auditId,
  onClose,
  onSaved,
}: {
  hotelId: string
  hotelName: string
  auditId?: string
  onClose: () => void
  onSaved?: () => void
}): ReactNode {
  return (
    <AuditFormDialog
      auditType="ENVIRONMENT"
      hotelId={hotelId}
      title="Percepción de Ambiente y Recursos"
      description={
        auditId
          ? `Corrige lo que haga falta de ${hotelName}: se guarda con PATCH, sobre la misma auditoría.`
          : `Insumos, relaciones, carga laboral y entorno de ${hotelName}.`
      }
      {...(auditId ? { auditId } : {})}
      onClose={onClose}
      {...(onSaved ? { onSaved } : {})}
    />
  )
}

import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

// Reglas de Negocio § Validación con expediente incompleto (unificado el
// 2026-09-30, Hugo: el SSN/ITIN dejó de tener su propio plazo — antes 3/4/5
// días desde la PRIMERA ASIGNACIÓN, sin casilla — y ahora es una pieza más
// del expediente a medias, con el mismo `profile_due_at` que transporte,
// contacto de emergencia y tipo de sangre. Este servicio ya no decide NADA
// sobre el acceso (eso es AccessDeadlineGuard/PROFILE_OVERDUE); solo arma la
// lectura para el banner del Colaborador — de dónde salía antes de esta
// unificación, sigue siendo el nombre que la persona reconoce en la app.
const TAX_DOCUMENT = 'SSN_ITIN'

export type TaxDeadlineStatus = 'OK' | 'NOTICE' | 'SUSPENDED'

export interface TaxDeadline {
  status: TaxDeadlineStatus
  /// Sin validación con expediente a medias todavía, el plazo no ha arrancado.
  hasStarted: boolean
  /// Días transcurridos desde que se validó a medias. Día 1 es ese día.
  day: number | null
  dueAt: string | null
  /// El documento subido, que es lo que corre el plazo.
  hasDocument: boolean
  /// El documento revisado por la Reclutadora. NO es lo que levanta la
  /// retencion: eso lo decide `has_tax_id`, que lee las columnas cifradas.
  isDocumentVerified: boolean
  /// La retencion es INDEPENDIENTE del plazo: aplica mientras no haya SSN/ITIN
  /// verificado, se haya suspendido el acceso o no.
  ///
  /// Una sola fuente, la misma que el expediente: `has_tax_id` de la vista.
  /// Mientras el cifrado de campo siga sin conectarse esto es SIEMPRE true —
  /// ver D-27.
  taxRetentionApplies: boolean
}

@Injectable()
export class TaxDeadlineService {
  constructor(private readonly prisma: PrismaService) {}

  async of(workerId: string, now = new Date()): Promise<TaxDeadline> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { profileDueAt: true },
    })
    const document = await this.prisma.workerDocument.findFirst({
      where: { workerId, documentType: TAX_DOCUMENT },
      select: { verifiedAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const hasDocument = document !== null
    const isDocumentVerified = document?.verifiedAt != null
    const hasTaxId = await this.hasTaxId(workerId)
    const profileDueAt = worker?.profileDueAt ?? null

    if (profileDueAt === null) {
      return {
        status: 'OK',
        hasStarted: false,
        day: null,
        dueAt: null,
        hasDocument,
        isDocumentVerified,
        taxRetentionApplies: !hasTaxId,
      }
    }

    // `profileDueAt` YA es la fecha límite (fijada como validated_at +
    // PROFILE_GRACE_DAYS en WorkersService): el "día 1" es el de la
    // validación, un día antes de esa fecha límite.
    const start = new Date(profileDueAt.getTime() - 86_400_000)
    const day = daysSince(start, now)

    return {
      status: hasDocument || now.getTime() <= profileDueAt.getTime() ? 'OK' : 'SUSPENDED',
      hasStarted: true,
      day,
      dueAt: profileDueAt.toISOString(),
      hasDocument,
      isDocumentVerified,
      taxRetentionApplies: !hasTaxId,
    }
  }

  // La misma consulta que el expediente. Dos definiciones de "tiene SSN" serian
  // dos respuestas distintas a si se le retiene el 16%.
  private async hasTaxId(workerId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ has: boolean }>>`
      SELECT has_tax_id AS has FROM personal.vw_worker WHERE id = ${workerId}::uuid`

    return rows[0]?.has ?? false
  }
}

// Por dias de calendario y no por horas: quien se dio de alta a las 23:50
// tendria medio dia menos que quien lo hizo a las 00:10.
function daysSince(from: Date, now: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  return Math.floor((today - start) / 86_400_000) + 1
}

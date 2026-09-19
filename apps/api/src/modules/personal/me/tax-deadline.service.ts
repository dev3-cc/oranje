import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

// Reglas del Colaborador § Plazo de SSN/ITIN. Tres dias desde el alta para
// CARGAR el documento; al cuarto un aviso, al quinto se suspende el acceso.
const GRACE_DAYS = 3
const NOTICE_DAY = 4
const SUSPEND_DAY = 5

const TAX_DOCUMENT = 'SSN_ITIN'

export type TaxDeadlineStatus = 'OK' | 'NOTICE' | 'SUSPENDED'

export interface TaxDeadline {
  status: TaxDeadlineStatus
  /// Dias transcurridos desde el alta. Dia 1 es el del alta.
  day: number
  dueAt: string
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

// Se calcula al leer y no lo escribe un job: un job que deja de correr
// suspende a nadie o a todos, y aqui la fecha del alta ya dice todo.
// Se cachea porque el guard lo consulta en CADA peticion del colaborador.
const CACHE_TTL_MS = 60_000

@Injectable()
export class TaxDeadlineService {
  private readonly cache = new Map<string, { suspended: boolean; expiresAt: number }>()

  constructor(private readonly prisma: PrismaService) {}

  // Al subir el documento la suspension se levanta AL INSTANTE. Sin esto la
  // persona sube su SSN y sigue fuera hasta que expire la cache, que es
  // exactamente el momento en que menos se entiende.
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  async of(workerId: string, createdAt: Date, now = new Date()): Promise<TaxDeadline> {
    const document = await this.prisma.workerDocument.findFirst({
      where: { workerId, documentType: TAX_DOCUMENT },
      select: { verifiedAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const hasDocument = document !== null
    const isDocumentVerified = document?.verifiedAt != null
    const hasTaxId = await this.hasTaxId(workerId)
    const day = daysSince(createdAt, now)
    const dueAt = new Date(createdAt.getTime() + GRACE_DAYS * 86_400_000)

    return {
      status: hasDocument ? 'OK' : statusFor(day),
      day,
      dueAt: dueAt.toISOString(),
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

  async isSuspended(userId: string): Promise<boolean> {
    const cached = this.cache.get(userId)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.suspended
    }

    const worker = await this.prisma.worker.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, createdAt: true },
    })

    const suspended =
      worker !== null && (await this.of(worker.id, worker.createdAt)).status === 'SUSPENDED'

    this.cache.set(userId, { suspended, expiresAt: Date.now() + CACHE_TTL_MS })

    return suspended
  }
}

function statusFor(day: number): TaxDeadlineStatus {
  if (day >= SUSPEND_DAY) {
    return 'SUSPENDED'
  }

  return day >= NOTICE_DAY ? 'NOTICE' : 'OK'
}

// Por dias de calendario y no por horas: quien se dio de alta a las 23:50
// tendria medio dia menos que quien lo hizo a las 00:10.
function daysSince(from: Date, now: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  return Math.floor((today - start) / 86_400_000) + 1
}

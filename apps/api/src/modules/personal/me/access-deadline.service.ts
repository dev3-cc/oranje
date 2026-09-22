import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

// Reglas de Negocio § Acceso del Colaborador y § Validación con expediente
// incompleto. Los plazos se calculan al leer, como el del SSN/ITIN: un job
// que deja de correr bloquea a nadie o a todos.
//
// La contraseña temporal (Hugo, 2026-09-22: aumentado de 3 a 30 días —
// muchos colaboradores comparten hoy Oranje.2026 y necesitan más margen
// antes de quedar bloqueados para ponchar).
export const PASSWORD_GRACE_DAYS = 30
// El expediente a medias se queda en 3 días: GRACE_DAYS solo reconstruye el
// "día N" que se muestra para ese plazo (línea 106), sin tocar su umbral real
// (`profileDueAt`, fijado en `WorkersService.PROFILE_GRACE_DAYS`).
export const GRACE_DAYS = 3

export type AccessDeadlineStatus = 'NONE' | 'PENDING' | 'OVERDUE'

export interface AccessDeadline {
  status: AccessDeadlineStatus
  /// Dias transcurridos desde que arranco el plazo. Dia 1 es el primero.
  day: number | null
  dueAt: string | null
}

/** Qué plazo venció: lo que el guard traduce a un 403 con su propio código. */
export type OverdueKind = 'PASSWORD' | 'PROFILE'

export interface AccessDeadlines {
  /// La contraseña temporal entregada en mano: hay que cambiarla desde la app.
  password: AccessDeadline
  /// Validado con el expediente a medias: hay que completarlo desde la app.
  profile: AccessDeadline
}

const CACHE_TTL_MS = 60_000

@Injectable()
export class AccessDeadlineService {
  private readonly cache = new Map<string, { overdue: OverdueKind[]; expiresAt: number }>()

  constructor(private readonly prisma: PrismaService) {}

  // Al cambiar la contraseña o completar el expediente el bloqueo se levanta
  // AL INSTANTE, no cuando expire la cache.
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  async of(userId: string, now = new Date()): Promise<AccessDeadlines> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tempPasswordIssuedAt: true },
    })
    const rows = await this.prisma.$queryRaw<
      Array<{ profileDueAt: Date | null; ownPartMissing: boolean }>
    >`
      SELECT profile_due_at AS "profileDueAt",
             (transport_type IS NULL
              OR emergency_contact_name IS NULL
              OR emergency_contact_phone IS NULL
              OR emergency_contact_relationship IS NULL
              OR blood_type IS NULL) AS "ownPartMissing"
        FROM personal.vw_worker
       WHERE (user_id = ${userId}::uuid OR legacy_user_id = ${userId}::uuid)
         AND deleted_at IS NULL
       LIMIT 1`
    const worker = rows[0]

    return {
      password: deadlineFrom(user?.tempPasswordIssuedAt ?? null, PASSWORD_GRACE_DAYS, now),
      // El plazo se queda escrito aunque despues se complete. Al colaborador
      // se le cobra SOLO por su parte (Fases 2 y 3): lo de la Fase 1 lo
      // completa Reclutamiento con «Editar» y no puede bloquearle el acceso
      // por algo que no esta en su mano.
      profile: worker?.ownPartMissing
        ? deadlineFrom(worker.profileDueAt, 0, now)
        : { status: 'NONE', day: null, dueAt: null },
    }
  }

  /** Lo que el guard consulta en cada peticion del colaborador. */
  async overdueOf(userId: string): Promise<OverdueKind[]> {
    const cached = this.cache.get(userId)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.overdue
    }

    const deadlines = await this.of(userId)
    const overdue: OverdueKind[] = [
      ...(deadlines.password.status === 'OVERDUE' ? ['PASSWORD' as const] : []),
      ...(deadlines.profile.status === 'OVERDUE' ? ['PROFILE' as const] : []),
    ]

    this.cache.set(userId, { overdue, expiresAt: Date.now() + CACHE_TTL_MS })

    return overdue
  }
}

/**
 * `from` es la fecha de arranque (contraseña emitida) y `graceDays` los dias
 * que corren desde ahi; para el perfil `from` YA es la fecha limite, asi que
 * va con 0 dias de gracia.
 */
function deadlineFrom(from: Date | null, graceDays: number, now: Date): AccessDeadline {
  if (!from) {
    return { status: 'NONE', day: null, dueAt: null }
  }

  const dueAt = new Date(from.getTime() + graceDays * 86_400_000)
  const start = graceDays === 0 ? new Date(dueAt.getTime() - GRACE_DAYS * 86_400_000) : from
  const day = daysSince(start, now)

  return {
    status: now.getTime() > dueAt.getTime() ? 'OVERDUE' : 'PENDING',
    day,
    dueAt: dueAt.toISOString(),
  }
}

// Por dias de calendario y no por horas, igual que el plazo fiscal.
function daysSince(from: Date, now: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  return Math.floor((today - start) / 86_400_000) + 1
}

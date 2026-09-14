import { randomBytes } from 'node:crypto'

import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { CPanelError, CPanelService } from '../../../infra/cpanel/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { StorageService } from '../../../infra/storage/index.js'

import type { CorporateEmailRow, MailboxCredential } from './entities/corporate-email.entity.js'

/**
 * El buzón REAL en cPanel (A2 Hosting) para el correo corporativo que un
 * colaborador ya tiene en Oranje (`identity.user.email`, @oranjepeople.com).
 *
 * Esto NO da de alta la cuenta en Oranje — eso lo hace el alta del
 * colaborador (Fase 1) o la migración; aquí solo se asegura que el correo ya
 * asignado tenga un buzón que de verdad reciba correo.
 */
@Injectable()
export class CorporateEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cpanel: CPanelService,
    private readonly storage: StorageService,
  ) {}

  async list(): Promise<CorporateEmailRow[]> {
    const domain = this.cpanel.domainName
    const [workers, mailboxes] = await Promise.all([
      this.prisma.worker.findMany({
        where: { deletedAt: null, account: { email: { endsWith: `@${domain}` } } },
        select: {
          id: true,
          fullName: true,
          photoPath: true,
          account: { select: { email: true, isActive: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.cpanel.enabled ? this.cpanel.listMailboxes() : Promise.resolve([]),
    ])

    const existing = new Set(mailboxes.map((row) => row.email.toLowerCase()))
    const photos = await this.signPhotos(workers)

    return workers
      .filter((worker) => worker.account !== null)
      .map((worker) => {
        const account = worker.account as { email: string; isActive: boolean }
        return {
          workerId: worker.id,
          workerName: worker.fullName,
          photoUrl: worker.photoPath ? (photos.get(worker.photoPath) ?? null) : null,
          email: account.email,
          isActive: account.isActive,
          mailboxExists: existing.has(account.email.toLowerCase()),
        }
      })
  }

  // Se firman las rutas distintas, no una por fila: la misma foto en dos filas
  // se firma una vez.
  private async signPhotos(rows: { photoPath: string | null }[]): Promise<Map<string, string>> {
    const paths = [...new Set(rows.flatMap((row) => (row.photoPath ? [row.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))

    return new Map(paths.map((path, index) => [path, urls[index] as string]))
  }

  async createMailbox(workerId: string): Promise<MailboxCredential> {
    const email = await this.corporateEmailOf(workerId)
    const password = generatePassword()

    await this.withCPanel(() =>
      this.cpanel.createMailbox(localPartOf(email, this.cpanel.domainName), password),
    )

    return { email, password }
  }

  async resetPassword(workerId: string): Promise<MailboxCredential> {
    const email = await this.corporateEmailOf(workerId)
    const password = generatePassword()

    await this.withCPanel(() =>
      this.cpanel.resetPassword(localPartOf(email, this.cpanel.domainName), password),
    )

    return { email, password }
  }

  async deleteMailbox(workerId: string): Promise<void> {
    const email = await this.corporateEmailOf(workerId)

    await this.withCPanel(() =>
      this.cpanel.deleteMailbox(localPartOf(email, this.cpanel.domainName)),
    )
  }

  // cPanel es un tercero: su rechazo (ya existe, cuota, credencial vencida)
  // no es un 500 nuestro — 502 con el motivo real, no "error inesperado".
  private async withCPanel<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof CPanelError) {
        throw new BadGatewayException({ code: 'CPANEL_ERROR', message: error.message })
      }
      throw error
    }
  }

  private async corporateEmailOf(workerId: string): Promise<string> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { account: { select: { email: true } } },
    })

    if (!worker) {
      throw new NotFoundException({ code: 'WORKER_NOT_FOUND', message: 'El colaborador no existe' })
    }

    const email = worker.account?.email

    if (!email || !email.endsWith(`@${this.cpanel.domainName}`)) {
      throw new ConflictException({
        code: 'NO_CORPORATE_EMAIL',
        message: 'Este colaborador no tiene un correo corporativo asignado en Oranje',
      })
    }

    return email
  }
}

function localPartOf(email: string, domain: string): string {
  return email.slice(0, email.length - domain.length - 1)
}

// 12 bytes -> 16 caracteres base64url: suficiente para un buzón de correo,
// nunca se persiste (D-27 ya sostiene ese criterio para el resto del sistema).
function generatePassword(): string {
  return randomBytes(12).toString('base64url')
}

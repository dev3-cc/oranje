import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreditDto, GenerateInvoiceDto } from './dto/invoice.dto.js'
import { InvoiceDetailRow, InvoiceRow, InvoicesRepository } from './invoices.repository.js'

const DRAFT = 'DRAFT'
const APPROVED = 'APPROVED'
const SENT = 'SENT'
const PAID = 'PAID'

export interface InvoiceEntity {
  id: string
  folio: string
  hotel: { id: string; name: string }
  status: string
  periodStart: string
  periodEnd: string
  totalAmount: string
  creditAmount: string
  approvedAt: string | null
  createdAt: string
  details?: InvoiceDetailRow[]
}

@Injectable()
export class InvoicesService {
  constructor(private readonly repo: InvoicesRepository) {}

  async generate(dto: GenerateInvoiceDto, user: AuthenticatedUser): Promise<InvoiceEntity> {
    if (dto.periodEnd < dto.periodStart) {
      throw new UnprocessableEntityException({
        code: 'PERIOD_BACKWARDS',
        message: 'El periodo termina antes de empezar',
      })
    }

    if (!(await this.repo.hotelExists(dto.hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    const already = await this.repo.existsForPeriod(dto.hotelId, dto.periodStart, dto.periodEnd)

    if (already) {
      throw new ConflictException({
        code: 'INVOICE_EXISTS',
        message: `Ese periodo ya está facturado con el folio ${already.folio}`,
      })
    }

    if ((await this.repo.approvedHours(dto.hotelId, dto.periodStart, dto.periodEnd)) === 0) {
      throw new ConflictException({
        code: 'NO_APPROVED_HOURS',
        message: 'Ese periodo no tiene un solo Timesheet aprobado',
      })
    }

    const id = await this.repo.generate({
      folio: await this.nextFolio(),
      hotelId: dto.hotelId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      userId: user.id,
      roleCode: user.roleCode,
    })

    if (!id) {
      throw new UnprocessableEntityException({
        code: 'NO_ACTIVE_CONTRACT',
        message: 'El hotel no tiene contrato vigente con tarifa para esas posiciones',
      })
    }

    return this.get(id)
  }

  async list(hotelId?: string, status?: string): Promise<InvoiceEntity[]> {
    return (await this.repo.listAll(hotelId ?? null, status ?? null)).map(toEntity)
  }

  async get(id: string): Promise<InvoiceEntity> {
    const row = await this.invoice(id)

    return { ...toEntity(row), details: await this.repo.details(id) }
  }

  async credit(id: string, dto: CreditDto, user: AuthenticatedUser): Promise<InvoiceEntity> {
    const row = await this.invoice(id)

    if (row.status !== DRAFT) {
      throw new ConflictException({
        code: 'INVOICE_NOT_DRAFT',
        message: `Una nota de crédito solo entra en borrador, y esta factura está en ${row.status}`,
      })
    }

    if (Number(row.creditAmount) + Number(dto.amount) > Number(row.totalAmount)) {
      throw new UnprocessableEntityException({
        code: 'CREDIT_EXCEEDS_TOTAL',
        message: 'El crédito no puede superar el total de la factura',
      })
    }

    await this.repo.addCredit({
      id,
      amount: dto.amount,
      note: dto.note,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  async approve(id: string, user: AuthenticatedUser): Promise<InvoiceEntity> {
    await this.assertStatus(id, DRAFT, 'aprobar')

    await this.repo.setStatus({
      id,
      status: APPROVED,
      approve: true,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'INVOICE_APPROVED',
    })

    return this.get(id)
  }

  async send(id: string, user: AuthenticatedUser): Promise<InvoiceEntity> {
    await this.assertStatus(id, APPROVED, 'enviar')

    await this.repo.setStatus({
      id,
      status: SENT,
      approve: false,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'INVOICE_SENT',
    })

    return this.get(id)
  }

  async markPaid(id: string, user: AuthenticatedUser): Promise<InvoiceEntity> {
    await this.assertStatus(id, SENT, 'marcar como pagada')

    await this.repo.setStatus({
      id,
      status: PAID,
      approve: false,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'INVOICE_PAID',
    })

    return this.get(id)
  }

  private async assertStatus(id: string, expected: string, action: string): Promise<void> {
    const row = await this.invoice(id)

    if (row.status !== expected) {
      throw new ConflictException({
        code: 'INVOICE_WRONG_STATUS',
        message: `Para ${action} la factura debe estar en ${expected}, y está en ${row.status}`,
      })
    }
  }

  private async nextFolio(): Promise<string> {
    const year = new Date().getUTCFullYear()

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `F-${year}-${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`

      if (!(await this.repo.folioTaken(candidate))) {
        return candidate
      }
    }

    throw new ConflictException({
      code: 'FOLIO_COLLISION',
      message: 'No se pudo generar un folio libre',
    })
  }

  private async invoice(id: string): Promise<InvoiceRow> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'La factura no existe' })
    }

    return row
  }
}

function toEntity(row: InvoiceRow): InvoiceEntity {
  return {
    id: row.id,
    folio: row.folio,
    hotel: row.hotel,
    status: row.status,
    periodStart: new Date(row.periodStart).toISOString().slice(0, 10),
    periodEnd: new Date(row.periodEnd).toISOString().slice(0, 10),
    totalAmount: row.totalAmount,
    creditAmount: row.creditAmount,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { v7 as uuidv7 } from 'uuid'

interface ErrorDetail {
  field: string
  message?: string
  value?: unknown
}

interface ErrorBody {
  error: {
    code: string
    message: string
    details?: ErrorDetail[]
    traceId: string
  }
}

// El `code` es estable: el frontend decide con él, no con el `message`.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const traceId = uuidv7()

    const { status, body } = this.describe(exception, traceId)

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} — ${traceId}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    response.status(status).json(body)
  }

  private describe(exception: unknown, traceId: string): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()

      if (typeof payload === 'object' && payload !== null && 'code' in payload) {
        const { code, message, details } = payload as Partial<ErrorBody['error']>

        return {
          status,
          body: {
            error: {
              code: code ?? 'ERROR',
              message: message ?? exception.message,
              ...(details ? { details } : {}),
              traceId,
            },
          },
        }
      }

      return {
        status,
        body: {
          error: { code: this.defaultCode(status), message: exception.message, traceId },
        },
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado', traceId },
      },
    }
  }

  private defaultCode(status: number): string {
    const byStatus: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE_VIOLATION',
    }

    return byStatus[status] ?? 'ERROR'
  }
}

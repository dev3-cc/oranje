import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { v7 as uuidv7 } from 'uuid'

/**
 * Un error tiene un `field` y opcionalmente el valor que lo provocó.
 */
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

/**
 * Toda respuesta de error sale con la MISMA forma — Estándares de Desarrollo §4.
 *
 * El `code` es `UPPER_SNAKE_CASE`, estable y catalogado: el frontend decide qué
 * mostrar a partir de él y **nunca** del `message`, que se puede reescribir sin
 * romper a nadie.
 *
 * Sin este filtro, Nest contesta `{ statusCode, message, error }`, que no es la
 * forma acordada y cambia según quién lanzó la excepción.
 */
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
      // El detalle del error queda en el log, no en la respuesta: un stack trace
      // en el body le dice a un atacante cómo está hecho el sistema
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

      // Lo que lanzó ZodValidationPipe: ya trae code, message y details
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
          error: {
            code: this.defaultCode(status),
            message: exception.message,
            traceId,
          },
        },
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocurrió un error inesperado',
          traceId,
        },
      },
    }
  }

  /**
   * Un `code` genérico por status, para las excepciones de Nest que no traen el
   * suyo. Cuando un caso importe de verdad, se lanza con su código catalogado.
   */
  private defaultCode(status: number): string {
    const porStatus: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE_VIOLATION',
    }

    return porStatus[status] ?? 'ERROR'
  }
}

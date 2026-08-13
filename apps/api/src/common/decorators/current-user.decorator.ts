import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

/** Lo que el guard cuelga del request tras validar el token. */
export interface AuthenticatedUser {
  id: string
  roleCode: string
  hotelId: string | null
  departmentId: string | null
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()

    return request.user
  },
)

import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC = 'isPublic'

/**
 * Exime a una ruta del guard de autenticación.
 *
 * El guard es global a propósito: así una ruta nueva nace protegida y hay que
 * abrirla explícitamente. Al revés — proteger de a una — se olvida.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true)

import { SetMetadata } from '@nestjs/common'

export const REQUIERE_PERMISO = 'requierePermiso'

export interface PermisoRequerido {
  module: string
  action: string
}

/**
 * Declara qué permiso de la Matriz exige una ruta.
 *
 * ```ts
 * @Requires('conversion', 'approve')
 * @Post(':id/approve')
 * ```
 *
 * El par `module`/`action` es el mismo de `identity.role_permission`, que se
 * siembra desde los `06 - Matriz de Permisos.md` del vault. Si la ruta pide un
 * par que no existe en la Matriz, nadie va a poder entrar — y eso es correcto:
 * significa que la acción no está autorizada para nadie todavía.
 */
export const Requires = (module: string, action: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIERE_PERMISO, { module, action })

import { SetMetadata } from '@nestjs/common'

export const REQUIERE_PERMISO = 'requierePermiso'

export interface PermisoRequerido {
  module: string
  action: string
}

// El par module/action es el de identity.role_permission. Si no existe en la
// Matriz, nadie entra — y eso es correcto.
export const Requires = (module: string, action: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIERE_PERMISO, { module, action })

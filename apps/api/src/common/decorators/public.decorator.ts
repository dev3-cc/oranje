import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC = 'isPublic'

// El guard es global: una ruta nueva nace protegida y hay que abrirla aquí.
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true)

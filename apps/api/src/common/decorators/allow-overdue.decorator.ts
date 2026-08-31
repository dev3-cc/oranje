import { SetMetadata } from '@nestjs/common'

export const ALLOW_OVERDUE = 'allowOverdue'

// La suspension del dia 5 bloquea al colaborador, pero no puede bloquear LO QUE
// LA LEVANTA: sin esto, subir el SSN/ITIN pide un acceso que la falta de
// SSN/ITIN quito, y la persona se queda encerrada sin salida.
export const AllowWhenOverdue = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_OVERDUE, true)

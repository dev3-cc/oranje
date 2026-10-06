import { Injectable, Logger } from '@nestjs/common'

import { MailerService } from '../../../infra/mailer/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'

/**
 * «¿Olvidaste tu contraseña?» con nuestro sobre.
 *
 * Hasta hoy este correo lo mandaba Firebase **desde el navegador** —
 * `sendPasswordResetEmail` del SDK —, así que era el único correo del sistema
 * que seguía saliendo con una plantilla que no se puede tocar. Ahora la
 * petición pasa por aquí: Firebase sigue emitiendo el enlace, y el correo es
 * de Oranje.
 *
 * **Nunca dice si el correo existe.** La respuesta es la misma para una
 * cuenta real, una inexistente y una dada de baja: lo contrario convierte
 * esta ruta —que es pública— en una forma de averiguar quién tiene cuenta.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      select: {
        id: true,
        fullName: true,
        locale: true,
        role: { select: { code: true, name: true } },
      },
    })

    if (!user) {
      /* Al log sí, porque aquí importa distinguir «nadie lo pidió» de «lo
         pidió alguien que no existe»; a quien pregunta, no. */
      this.logger.log(`Restablecimiento pedido para ${email}, que no tiene cuenta activa`)

      return
    }

    await this.mailer.sendAccountEmail({
      kind: 'password-reset',
      to: email,
      name: user.fullName,
      roleCode: user.role.code,
      roleName: user.role.name,
      locale: user.locale === 'en' ? 'en' : 'es',
      userId: user.id,
    })
  }
}

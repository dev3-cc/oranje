import { Global, Module } from '@nestjs/common'

import { FirebaseAccountsService } from './firebase-accounts.service.js'

/**
 * Global como `CPanelModule`: el cliente de Identity Toolkit es infraestructura
 * y lo usan ya cuatro módulos de negocio (users, workers, me y el mailer, que
 * lo necesita como respaldo cuando el SMTP propio falla).
 */
@Global()
@Module({
  providers: [FirebaseAccountsService],
  exports: [FirebaseAccountsService],
})
export class FirebaseModule {}

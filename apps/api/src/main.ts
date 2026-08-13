import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module.js'
import { HttpExceptionFilter } from './common/filters/index.js'
import { ZodValidationPipe } from './common/pipes/index.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  // §4: la versión va en la ruta
  app.setGlobalPrefix('api/v1')

  // El refresh token viaja en cookie httpOnly (§6), no en el body
  app.use(cookieParser())

  // §6: ningún body llega a un controller sin validar
  app.useGlobalPipes(new ZodValidationPipe())

  // §4: todo error sale con la misma forma
  app.useGlobalFilters(new HttpExceptionFilter())

  // §6: lista blanca explícita de orígenes
  app.enableCors({ origin: false })

  // Sin esto, un SIGTERM mata el proceso sin cerrar el pool de Postgres
  app.enableShutdownHooks()

  const port = process.env['PORT'] ?? 3000
  await app.listen(port)

  new Logger('Bootstrap').log(`API escuchando en http://localhost:${port}/api/v1`)
}

void bootstrap()

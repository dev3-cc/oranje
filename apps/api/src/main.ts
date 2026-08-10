import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'
import { HttpExceptionFilter } from './common/filters/index.js'
import { ZodValidationPipe } from './common/pipes/index.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  // Estándares de Desarrollo §4: la versión va en la ruta
  app.setGlobalPrefix('api/v1')

  // §6: ningún body llega a un controller sin validar.
  // Es Zod y no el ValidationPipe de Nest: ese exige class-validator, y el
  // schema de validación ya existe en packages/contracts y lo comparten el web
  // y el móvil. Dos declaraciones de la misma regla se desincronizan
  app.useGlobalPipes(new ZodValidationPipe())

  // §4: todo error sale con la misma forma { error: { code, message, traceId } }
  app.useGlobalFilters(new HttpExceptionFilter())

  // §6: lista blanca explícita de orígenes
  app.enableCors({ origin: false })

  // Sin esto, un SIGTERM de Cloud Run mata el proceso sin cerrar el pool de
  // Postgres: las conexiones quedan colgadas hasta que la base las expira
  app.enableShutdownHooks()

  const port = process.env['PORT'] ?? 3000
  await app.listen(port)

  new Logger('Bootstrap').log(`API escuchando en http://localhost:${port}/api/v1`)
}

void bootstrap()

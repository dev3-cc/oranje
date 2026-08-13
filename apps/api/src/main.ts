import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module.js'
import { HttpExceptionFilter } from './common/filters/index.js'
import { ZodValidationPipe } from './common/pipes/index.js'
import type { Env } from './config/env.validation.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService<Env, true>)
  const appEnv = config.get('APP_ENV', { infer: true })

  // §4: la versión va en la ruta
  app.setGlobalPrefix('api/v1')

  // El refresh token viaja en cookie httpOnly (§6), no en el body
  app.use(cookieParser())

  // §6: ningún body llega a un controller sin validar
  app.useGlobalPipes(new ZodValidationPipe())

  // §4: todo error sale con la misma forma
  app.useGlobalFilters(new HttpExceptionFilter())

  // §6: lista blanca explícita. En local se abre porque el front corre en otro
  // puerto y no hay nada que proteger; fuera de local la lista es obligatoria y
  // la validación de entorno no deja arrancar sin ella
  app.enableCors({
    origin: appEnv === 'local' ? true : config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  })

  // Sin esto, un SIGTERM mata el proceso sin cerrar el pool de Postgres
  app.enableShutdownHooks()

  const port = config.get('PORT', { infer: true })
  await app.listen(port)

  new Logger('Bootstrap').log(`API en http://localhost:${port}/api/v1 · APP_ENV=${appEnv}`)
}

void bootstrap()

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

  app.setGlobalPrefix('api/v1')

  app.use(cookieParser())

  app.useGlobalPipes(new ZodValidationPipe())

  app.useGlobalFilters(new HttpExceptionFilter())

  // En local se abre: el front corre en otro puerto. Fuera de local la lista
  // es obligatoria y sin ella la app no arranca.
  app.enableCors({
    origin: appEnv === 'local' ? true : config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  })

  // Sin esto un SIGTERM mata el proceso sin cerrar el pool.
  app.enableShutdownHooks()

  const port = config.get('PORT', { infer: true })
  await app.listen(port)

  new Logger('Bootstrap').log(`API en http://localhost:${port}/api/v1 · APP_ENV=${appEnv}`)
}

void bootstrap()

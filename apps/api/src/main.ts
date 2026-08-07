import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  // Estándares de Desarrollo §4: la versión va en la ruta
  app.setGlobalPrefix('api/v1')

  // §6: ningún body llega a un controller sin validar
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // §6: lista blanca explícita de orígenes
  app.enableCors({ origin: false })

  const port = process.env['PORT'] ?? 3000
  await app.listen(port)
}

void bootstrap()

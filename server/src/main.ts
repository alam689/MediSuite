import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  // Dev convenience only — in production the Vite build is served behind the
  // same origin (or a reverse proxy) and CORS should be locked down.
  app.enableCors()

  // Not PORT: the Vite dev server already claims PORT in some environments.
  const port = Number(process.env.API_PORT || 4000)
  await app.listen(port)
  console.log(`AITMS API listening on http://localhost:${port}/api`)
}

bootstrap()

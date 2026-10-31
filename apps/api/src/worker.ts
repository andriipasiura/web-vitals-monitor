import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module.js';
import { WorkersService } from './worker/workers.service.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  await app.get(WorkersService).scheduleMaintenance();
}
await bootstrap();

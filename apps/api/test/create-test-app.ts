import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { appOptions, configureApp } from '../src/app.options.js';
import { WorkerModule } from '../src/worker/worker.module.js';

type Override = (builder: TestingModuleBuilder) => TestingModuleBuilder;

export async function createTestApp(
  override?: Override,
): Promise<NestExpressApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  const moduleRef = await (override ? override(builder) : builder).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...appOptions,
    logger: false,
  });
  configureApp(app);
  await app.init();
  return app;
}

export async function createTestWorker(
  override?: Override,
): Promise<TestingModule> {
  const builder = Test.createTestingModule({ imports: [WorkerModule] });
  const moduleRef = await (override ? override(builder) : builder).compile();
  moduleRef.useLogger(false);
  await moduleRef.init();
  return moduleRef;
}

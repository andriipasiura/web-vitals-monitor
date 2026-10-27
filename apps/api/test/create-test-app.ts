import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { appOptions, configureApp } from '../src/app.options.js';

export async function createTestApp(
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
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

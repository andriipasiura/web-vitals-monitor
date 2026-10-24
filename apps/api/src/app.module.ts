import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { z } from 'zod';
import { ConfigModule } from '@nestjs/config';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = EnvSchema.safeParse(config);
        if (!result.success) {
          throw new Error(`Invalid env:\n${z.prettifyError(result.error)}`);
        }
        return result.data;
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

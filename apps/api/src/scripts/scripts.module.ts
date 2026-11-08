import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AUTH_LIMITS } from '@rum/shared';
import { z } from 'zod';
import { DatabaseModule } from '../db/database.module.js';
import { RollupsModule } from '../rollups/rollups.module.js';

const ScriptEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
  SEED_DEMO_PASSWORD: z
    .string()
    .min(AUTH_LIMITS.minPasswordLength)
    .default('demo-password'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => ScriptEnvSchema.parse(config),
    }),
    DatabaseModule,
    RollupsModule,
  ],
})
export class ScriptsModule {}

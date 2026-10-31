import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { DatabaseModule } from '../db/database.module.js';
import { RollupsModule } from '../rollups/rollups.module.js';

const ScriptEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
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

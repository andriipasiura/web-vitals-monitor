import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateWorkerEnv } from '../config/env.js';
import { DatabaseModule } from '../db/database.module.js';
import { EventsStoreModule } from '../events/events-store.module.js';
import { PartitionsService } from '../events/partitions.service.js';
import { WORKER_COMMAND_CLIENT_OPTIONS } from '../redis/redis.js';
import { RedisModule } from '../redis/redis.module.js';
import { RollupsModule } from '../rollups/rollups.module.js';
import { EventsProcessor } from './events.processor.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { WorkersService } from './workers.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnv }),
    DatabaseModule,
    RedisModule.forRoot(WORKER_COMMAND_CLIENT_OPTIONS),
    EventsStoreModule,
    RollupsModule,
  ],
  providers: [
    EventsProcessor,
    MaintenanceProcessor,
    PartitionsService,
    WorkersService,
  ],
})
export class WorkerModule {}

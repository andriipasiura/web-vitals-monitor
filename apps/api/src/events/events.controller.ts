import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EventBatchSchema, type EventBatch } from '@rum/shared';
import { ApiKeyGuard, CurrentProject } from '../api-keys/api-key.guard.js';
import { Public } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { EventsService } from './events.service.js';

@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(
    @CurrentProject() project: { id: string },
    @Body(new ZodValidationPipe(EventBatchSchema)) batch: EventBatch,
  ): Promise<void> {
    await this.eventsService.ingest(project.id, batch.events);
  }
}

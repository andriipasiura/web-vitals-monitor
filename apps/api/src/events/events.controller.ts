import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { EventBatchSchema, type EventBatch } from '@rum/shared';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { EventsService } from './events.service.js';

@Controller('v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(
    @Body(new ZodValidationPipe(EventBatchSchema)) batch: EventBatch,
  ): Promise<void> {
    await this.eventsService.ingest(batch.events);
  }
}

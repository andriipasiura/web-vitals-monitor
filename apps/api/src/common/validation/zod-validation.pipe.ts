import { HttpStatus, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { ApiException } from '../errors/api-exception.js';

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      code: issue.code,
      message: issue.message,
    }));
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Request validation failed',
      details,
    );
  }
}

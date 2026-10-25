import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { ensureRequestId } from '../request-id/request-id.middleware.js';
import { ApiException } from './api-exception.js';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = ensureRequestId(req, res);
    const { status, ...error } = mapException(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} failed (requestId=${requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (res.headersSent) {
      res.end();
      return;
    }

    const body: ErrorResponseBody = { error: { ...error, requestId } };
    res.status(status).json(body);
  }
}

function mapException(exception: unknown): MappedError {
  if (exception instanceof ApiException) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      status,
      code: HttpStatus[status] ?? 'HTTP_ERROR',
      message:
        status < 500 ? exception.message : (STATUS_CODES[status] ?? 'Error'),
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

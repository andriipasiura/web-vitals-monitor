import { HttpStatus } from '@nestjs/common';
import { json } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiException } from '../errors/api-exception.js';

export const DASHBOARD_BODY_LIMIT_BYTES = 16 * 1024;

export interface JsonBodyParserOptions {
  limit: number;
  types: string[];
}

interface BodyParserError extends Error {
  type: string;
  status: number;
}

export function createJsonBodyParser({
  limit,
  types,
}: JsonBodyParserOptions): RequestHandler {
  const parse = json({ limit, type: types, strict: true });

  return (req: Request, res: Response, next: NextFunction) => {
    const isEmpty = req.headers['content-length'] === '0';
    if (!isEmpty && req.is(types) === false) {
      next(
        new ApiException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'UNSUPPORTED_MEDIA_TYPE',
          `Content-Type must be one of: ${types.join(', ')}`,
        ),
      );
      return;
    }

    parse(req, res, (err?: unknown) => {
      if (err) next(mapBodyParserError(err, limit));
      else next();
    });
  };
}

function mapBodyParserError(err: unknown, limit: number): unknown {
  if (!isBodyParserError(err)) return err;

  switch (err.type) {
    case 'entity.too.large':
      return new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PAYLOAD_TOO_LARGE',
        `Request body must not exceed ${limit} bytes`,
      );
    case 'entity.parse.failed':
      return new ApiException(
        HttpStatus.BAD_REQUEST,
        'MALFORMED_JSON',
        'Request body must be a valid JSON object',
      );
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return new ApiException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UNSUPPORTED_MEDIA_TYPE',
        'Unsupported charset or content encoding',
      );
    default:
      return err.status < 500
        ? new ApiException(
            err.status,
            HttpStatus[err.status] ?? 'BAD_REQUEST',
            err.message,
          )
        : err;
  }
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    err instanceof Error &&
    typeof (err as Partial<BodyParserError>).type === 'string' &&
    typeof (err as Partial<BodyParserError>).status === 'number'
  );
}

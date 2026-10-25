import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const INCOMING_REQUEST_ID = /^[\w.:=-]{1,128}$/;

export function ensureRequestId(req: Request, res: Response): string {
  if (req.requestId) return req.requestId;

  const incoming = req.get(REQUEST_ID_HEADER);
  const requestId =
    incoming && INCOMING_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  if (!res.headersSent) res.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  ensureRequestId(req, res);
  next();
}

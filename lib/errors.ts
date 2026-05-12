import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { headers } from 'next/headers';
import { logger } from './logger';
import { reportError } from './error-sink';

// Standard error envelope. Every API route should return errors via these
// helpers so clients can switch on `code` (not parse a freeform message).
//
// Shape: { error: { code: 'INVALID_INPUT', message: '...', requestId, details? } }

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;
  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function requestId(): Promise<string | undefined> {
  try {
    return (await headers()).get('x-request-id') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, requestId: await requestId(), details } },
    { status },
  );
}

// Wrap any API handler so thrown ApiError / ZodError / unknown errors map
// to a stable envelope and end up in the logger.
export function apiHandler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const rid = await requestId();
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, requestId: rid, details: err.details } },
          { status: err.status },
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'Validation failed', requestId: rid, details: err.flatten() } },
          { status: 400 },
        );
      }
      const path = new URL(req.url).pathname;
      logger.error({ err, requestId: rid, path }, 'unhandled api error');
      reportError({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        requestId: rid,
        path,
        level: 'error',
      });
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Internal server error', requestId: rid } },
        { status: 500 },
      );
    }
  };
}

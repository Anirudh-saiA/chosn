import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Closes a real gap found while verifying today's SENTRY_DSN setup:
 * every existing `Sentry.captureException` call in this codebase sits
 * at a specific background-job site (price-fetch queue, drop scheduler,
 * the DB pool) — nothing reported a plain REST controller error to
 * Sentry at all. NestJS's own exception handling catches a thrown error
 * and formats the HTTP response before it ever reaches Node's
 * "unhandled" machinery, so `@sentry/node`'s automatic instrumentation
 * never saw it either.
 *
 * Only reports HttpExceptions with status >= 500 (or anything that
 * isn't an HttpException at all, e.g. a raw `throw new Error(...)` —
 * always a bug) — a 404 or a 400 from bad input is expected traffic,
 * not something worth an alert. `super.catch()` still delegates to
 * Nest's own BaseExceptionFilter for the actual response, so this
 * changes nothing about what a caller receives.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!isHttpException || status >= 500) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}

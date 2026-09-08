import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiJwtPayload, verifyApiToken } from './api-jwt';

/** Augments Express's Request with the verified caller — set by this guard, read by anything downstream (ReportsController.create, AdminGuard, etc.) that needs "who is making this request." */
export interface AuthenticatedRequest extends Request {
  user: ApiJwtPayload;
}

/**
 * Day 17's first real HTTP consumer of `verifyApiToken` — every
 * endpoint before today either stayed fully open (catalog, drops) or
 * used `RateLimitGuard` instead, and `DropLiveGateway` (Day 16) only
 * ever downgrades an unauthenticated caller to anonymous, never
 * rejects. Filing a report or blocking a user is different: it must be
 * attributable to a real account (`reporter_user_id`/`blocker_user_id`
 * are `NOT NULL` — see 0009_trust_safety.sql), so this guard actually
 * rejects, unlike every guard that came before it.
 *
 * Expects `Authorization: Bearer <apiToken>` — the same short-lived
 * token apps/web mints in its NextAuth `session()` callback
 * (`lib/auth/api-token.ts`) and already sends as a WS `?token=` query
 * param; this is the header equivalent for plain HTTP calls.
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new UnauthorizedException({ error: 'unauthenticated', message: 'Sign in to do that.' });
    }

    const payload = verifyApiToken(token);
    if (!payload) {
      throw new UnauthorizedException({ error: 'unauthenticated', message: 'Your session has expired — sign in again.' });
    }

    request.user = payload;
    return true;
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { verifyApiToken, type ApiJwtPayload } from './api-jwt';

/** Unlike `AuthenticatedRequest`, `user` here is genuinely optional — an anonymous caller is a normal, expected case for every route this guard protects. */
export interface OptionallyAuthenticatedRequest extends Request {
  user?: ApiJwtPayload;
}

/**
 * The community feed's read endpoints are public (task 4 — browsing
 * doesn't require an account, only posting/voting/commenting does), but
 * still need to know *who's* asking when someone is signed in: viewerVote,
 * viewerChoice, and the block-exclusion list all depend on it.
 * `ApiAuthGuard` always rejects an unauthenticated caller (the right
 * choice for a write); this is the read-side counterpart — identifies
 * the caller when a valid token is present, never rejects when one
 * isn't. `req.user` is `undefined`, not set to a fake value, when
 * anonymous — every call site here reads it as `req.user?.userId ?? null`.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<OptionallyAuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) return true;

    const payload = verifyApiToken(token);
    if (payload) request.user = payload;
    return true;
  }
}

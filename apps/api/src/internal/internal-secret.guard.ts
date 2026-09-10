import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Protects routes meant for apps/web only, not the public internet —
 * this app has no other service-to-service caller. Reuses
 * `API_JWT_SECRET` as a plain shared-secret header rather than
 * introducing a new env var: it's already set on both Railway and
 * Vercel (confirmed — the Day 16 apiToken flow depends on it), and the
 * blast radius of reusing it here is low (this guard's only job is
 * "prove you're apps/web," not "forge a user identity" — nothing this
 * endpoint does touches user data or sessions). A dedicated secret
 * would be marginally cleaner but means one more manual env var round
 * trip across two dashboards for a low-stakes endpoint; not worth it
 * here. Revisit if a second internal-only endpoint with higher stakes
 * ever needs this same pattern.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-secret'];
    const expected = process.env.API_JWT_SECRET;

    if (!expected || provided !== expected) {
      throw new ForbiddenException({ error: 'forbidden', message: 'Internal endpoint.' });
    }
    return true;
  }
}

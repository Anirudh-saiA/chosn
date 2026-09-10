import { applyDecorators, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from './optional-auth.guard';

/** `@OptionalAuth()` on a route handler — identifies the caller when a token is present, never rejects when one isn't. See OptionalAuthGuard's own doc comment. */
export function OptionalAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(OptionalAuthGuard));
}

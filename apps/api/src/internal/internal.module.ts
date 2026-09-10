import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { AuthRateLimitController } from './auth-rate-limit.controller';
import { SessionRevocationController } from './session-revocation.controller';

/** Imports PricingModule for REDIS_CLIENT — reused, not a new connection, same "don't open a second client" reasoning every other module here follows. */
@Module({
  imports: [PricingModule],
  controllers: [AuthRateLimitController, SessionRevocationController],
})
export class InternalModule {}

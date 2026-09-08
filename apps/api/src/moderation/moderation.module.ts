import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { pgPoolProvider } from '../db/db.provider';
import { ModerationController } from './moderation.controller';

@Module({
  controllers: [ModerationController],
  // AdminGuard needs PG_POOL; ApiAuthGuard needs nothing injected.
  providers: [pgPoolProvider, AdminGuard],
})
export class ModerationModule {}

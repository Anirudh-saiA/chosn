import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatalogModule } from './catalog/catalog.module';
import { DropsModule } from './drops/drops.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ModerationModule } from './moderation/moderation.module';
import { PricingModule } from './pricing/pricing.module';
import { TrustSafetyModule } from './trust-safety/trust-safety.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    WaitlistModule,
    PricingModule,
    CatalogModule,
    DropsModule,
    TrustSafetyModule,
    ModerationModule,
    FeedbackModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

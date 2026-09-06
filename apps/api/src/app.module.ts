import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PricingModule } from './pricing/pricing.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [WaitlistModule, PricingModule],
  controllers: [AppController],
})
export class AppModule {}

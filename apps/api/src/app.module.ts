import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatalogModule } from './catalog/catalog.module';
import { DropsModule } from './drops/drops.module';
import { PricingModule } from './pricing/pricing.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [WaitlistModule, PricingModule, CatalogModule, DropsModule],
  controllers: [AppController],
})
export class AppModule {}

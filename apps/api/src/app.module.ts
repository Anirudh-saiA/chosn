import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [WaitlistModule],
  controllers: [AppController],
})
export class AppModule {}

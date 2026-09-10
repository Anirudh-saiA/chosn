import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { ReputationModule } from '../reputation/reputation.module';
import { TrustSafetyModule } from '../trust-safety/trust-safety.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatMessagesService } from './chat-messages.service';
import { ChatRoomSchedulerService } from './chat-room-scheduler.service';
import { ChatRoomsService } from './chat-rooms.service';

/**
 * Day 22's per-drop live chat: room lifecycle (auto-open/auto-archive,
 * mirroring DropSchedulerService's Day 13 shape), the WebSocket gateway
 * extending Day 14's `ws`-based pattern, and the REST reads a page needs
 * before it ever opens a socket (task 5/6). Imports PricingModule for
 * DRIZZLE and REDIS_CLIENT — both already exported there for exactly
 * this "don't open a second pool/redis client" reason (see that
 * module's own doc comment) — TrustSafetyModule for BlocksService
 * (task 7's block enforcement, added after the fact — see chat.gateway.ts
 * and chat-messages.service.ts's own comments on where it's applied) —
 * and (Day 23) ReputationModule for the badge next to a chat author's name.
 */
@Module({
  imports: [PricingModule, TrustSafetyModule, ReputationModule],
  controllers: [ChatController],
  providers: [ChatRoomsService, ChatMessagesService, ChatRoomSchedulerService, ChatGateway],
})
export class ChatModule {}

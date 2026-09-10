import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
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
 * module's own doc comment).
 */
@Module({
  imports: [PricingModule],
  controllers: [ChatController],
  providers: [ChatRoomsService, ChatMessagesService, ChatRoomSchedulerService, ChatGateway],
})
export class ChatModule {}

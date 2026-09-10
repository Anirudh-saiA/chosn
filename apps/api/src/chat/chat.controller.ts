import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { OptionalAuth } from '../auth/optional-auth.decorator';
import type { OptionallyAuthenticatedRequest } from '../auth/optional-auth.guard';
import { ChatMessagesService } from './chat-messages.service';
import { ChatRoomsService } from './chat-rooms.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly rooms: ChatRoomsService,
    private readonly messages: ChatMessagesService,
  ) {}

  /** The chat UI's first call on a drop detail page: is there a room for this drop yet, and what state is it in? */
  @Get('rooms/by-drop/:dropEventId')
  async byDrop(@Param('dropEventId', new ParseUUIDPipe()) dropEventId: string) {
    const room = await this.rooms.getByDropEvent(dropEventId);
    return { room };
  }

  /**
   * History load on connect — the WebSocket itself only ever pushes new
   * messages, never replays past ones (see ChatGateway's own comment).
   * Works for an archived room too (task 5: read-only, not deleted).
   * `OptionalAuth` (not required) identifies a signed-in viewer for
   * task 7's block filtering without requiring sign-in just to read a
   * public chat's history.
   */
  @Get('rooms/:id/messages')
  @OptionalAuth()
  async history(
    @Req() req: OptionallyAuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
  ) {
    const room = await this.rooms.getById(id);
    if (!room) throw new NotFoundException({ error: 'not_found', message: 'Chat room not found.' });
    const parsedLimit = limit ? Math.min(Math.max(Number(limit) || 100, 1), 200) : 100;
    return { messages: await this.messages.history(id, parsedLimit, req.user?.userId ?? null) };
  }
}

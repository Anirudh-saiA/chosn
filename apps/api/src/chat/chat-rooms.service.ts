import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { chatRooms } from '../db/schema';

export interface ChatRoomSummary {
  id: string;
  dropEventId: string;
  status: 'scheduled' | 'open' | 'archived';
  opensAt: string;
  archivesAt: string | null;
}

@Injectable()
export class ChatRoomsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async getByDropEvent(dropEventId: string): Promise<ChatRoomSummary | null> {
    const [row] = await this.db.select().from(chatRooms).where(eq(chatRooms.dropEventId, dropEventId)).limit(1);
    return row ? this.toSummary(row) : null;
  }

  async getById(id: string): Promise<ChatRoomSummary | null> {
    const [row] = await this.db.select().from(chatRooms).where(eq(chatRooms.id, id)).limit(1);
    return row ? this.toSummary(row) : null;
  }

  private toSummary(row: typeof chatRooms.$inferSelect): ChatRoomSummary {
    return {
      id: row.id,
      dropEventId: row.dropEventId,
      status: row.status,
      opensAt: row.opensAt.toISOString(),
      archivesAt: row.archivesAt ? row.archivesAt.toISOString() : null,
    };
  }
}

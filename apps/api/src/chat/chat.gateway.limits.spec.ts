import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { ChatGateway } from './chat.gateway';

/** SEC-13: a socket may only join UUID rooms, at most 20 of them, and empty rooms are dropped from memory. */
function connect() {
  const gw = new ChatGateway({} as never, {} as never, {} as never, {} as never);
  const client = Object.assign(new EventEmitter(), { OPEN: 1, readyState: 1, send: vi.fn() });
  gw.handleConnection(client as never, { url: '/ws/chat' } as IncomingMessage);
  const frame = async (f: unknown) => {
    client.emit('message', Buffer.from(JSON.stringify(f)));
    await new Promise((r) => setImmediate(r));
  };
  const ping = (roomId: string) => {
    client.send.mockClear();
    (gw as unknown as { broadcastToRoom: (r: string, p: unknown) => void }).broadcastToRoom(roomId, { hi: 1 });
    return client.send.mock.calls.length;
  };
  return { client, frame, ping };
}
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('ChatGateway room limits (SEC-13)', () => {
  it('ignores a join for an id that is not a UUID', async () => {
    const { frame, ping } = connect();
    await frame({ type: 'chat:join', roomId: 'x'.repeat(5000) });
    expect(ping('x'.repeat(5000))).toBe(0);
  });

  it('joins a UUID room, and stops at 20 rooms per socket', async () => {
    const { frame, ping } = connect();
    for (let i = 1; i <= 25; i++) await frame({ type: 'chat:join', roomId: uuid(i) });
    expect(ping(uuid(1))).toBe(1);
    expect(ping(uuid(20))).toBe(1);
    expect(ping(uuid(21))).toBe(0);
  });

  it('stops delivering after leave', async () => {
    const { frame, ping } = connect();
    await frame({ type: 'chat:join', roomId: uuid(1) });
    await frame({ type: 'chat:leave', roomId: uuid(1) });
    expect(ping(uuid(1))).toBe(0);
  });
});

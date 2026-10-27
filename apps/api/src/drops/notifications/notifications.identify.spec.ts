import { describe, expect, it } from 'vitest';
import type { Db } from '../../db/drizzle.provider';
import { NotificationsService } from './notifications.service';

/** SEC-1: identify() must never return an existing subscriber's id because someone typed that person's e-mail. */
function fakeDb() {
  const rows: { id: string; email: string | null }[] = [];
  let n = 0;
  const db = {
    select: () => {
      throw new Error('identify() must not look subscribers up by e-mail');
    },
    insert: () => ({
      values: (v: { email?: string }) => {
        const email = v.email ?? null;
        const insert = () => {
          if (email !== null && rows.some((r) => r.email === email)) return [];
          const row = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, email };
          rows.push(row);
          return [{ id: row.id }];
        };
        return { onConflictDoNothing: () => ({ returning: async () => insert() }), returning: async () => insert() };
      },
    }),
  };
  return { db: db as unknown as Db, rows };
}

describe('NotificationsService.identify (SEC-1)', () => {
  it('gives two different ids when the same e-mail is typed twice, and the address stays on the first row only', async () => {
    const { db, rows } = fakeDb();
    const svc = new NotificationsService(db);
    const first = await svc.identify('victim@example.com');
    const second = await svc.identify('VICTIM@example.com ');
    expect(second.subscriberId).not.toBe(first.subscriberId);
    expect(rows.filter((r) => r.email === 'victim@example.com')).toHaveLength(1);
    expect(rows.find((r) => r.id === second.subscriberId)?.email).toBeNull();
  });

  it('still mints an anonymous id with no e-mail', async () => {
    const { db } = fakeDb();
    const svc = new NotificationsService(db);
    expect((await svc.identify()).subscriberId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

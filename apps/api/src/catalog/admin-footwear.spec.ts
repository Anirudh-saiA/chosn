import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { AdminFootwearController, SetFootwearTypeDto } from './admin-footwear.controller';

const dialect = new PgDialect();
type Q = Parameters<PgDialect['sqlToQuery']>[0];
const fake = (rows: unknown[]) => {
  const seen: Array<{ sql: string; params: unknown[] }> = [];
  return { seen, ctl: new AdminFootwearController({ execute: async (q: Q) => (seen.push(dialect.sqlToQuery(q)), { rows }) } as never) };
};

describe('admin footwear override', () => {
  it('is behind the login and admin guards', () => {
    const guards = Reflect.getMetadata('__guards__', AdminFootwearController) as unknown[];
    expect(guards).toEqual([ApiAuthGuard, AdminGuard]);
  });
  it('accepts only the four types', async () => {
    const check = (footwearType: unknown) => validate(plainToInstance(SetFootwearTypeDto, { footwearType }));
    for (const ok of ['sneaker', 'slide', 'sandal', 'other']) expect(await check(ok)).toHaveLength(0);
    for (const bad of ['boot', '', "sneaker'; --", 5, undefined]) expect((await check(bad)).length).toBeGreaterThan(0);
  });
  it('marks a correction manual so the rule never overrides it, and 404s for an unknown shoe', async () => {
    const ok = fake([{ style_code: 'X', footwear_type: 'sneaker', footwear_type_manual: true }]);
    await ok.ctl.setType('X', { footwearType: 'sneaker' });
    expect(ok.seen[0]!.sql).toContain('footwear_type_manual = true');
    expect(ok.seen[0]!.params).toEqual(['sneaker', 'X']);
    await expect(fake([]).ctl.setType('NOPE', { footwearType: 'slide' })).rejects.toThrow();
  });
  it('lists hidden shoes, never sneakers, with a capped limit', async () => {
    const f = fake([]);
    await f.ctl.hidden('sneaker', '99999');
    expect(f.seen[0]!.sql).toContain("footwear_type <> 'sneaker'");
    expect(f.seen[0]!.params).toEqual([500]);
    await f.ctl.hidden('slide', undefined);
    expect(f.seen[1]!.sql).toContain('footwear_type = $1');
    expect(f.seen[1]!.params).toEqual(['slide', 100]);
  });
});

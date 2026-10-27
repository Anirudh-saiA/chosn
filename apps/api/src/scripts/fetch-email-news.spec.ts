import { describe, expect, it } from 'vitest';
import { aligned, authenticated, matchSender } from './fetch-email-news';

describe('authenticated (SEC-8)', () => {
  it('accepts a DKIM pass signed by the From domain', () => {
    const h = 'mx.google.com; dkim=pass header.i=@nike.com header.s=s1 header.b=abc; spf=fail smtp.mailfrom=x@bounce.example';
    expect(authenticated(h, 'news@nike.com')).toBe(true);
  });

  it('accepts a DKIM pass signed by a parent or sub domain of the From domain', () => {
    expect(authenticated('mx.google.com; dkim=pass header.d=nike.com', 'news@e.nike.com')).toBe(true);
    expect(authenticated('mx.google.com; dkim=pass header.d=e.nike.com', 'news@nike.com')).toBe(true);
  });

  it('accepts an SPF pass for the From domain', () => {
    expect(authenticated('mx.google.com; spf=pass smtp.mailfrom=bounce@superkicks.in', 'hello@superkicks.in')).toBe(true);
  });

  it('accepts a DMARC pass for the From domain', () => {
    expect(authenticated('mx.google.com; dmarc=pass (p=REJECT) header.from=adidas.com', 'info@adidas.com')).toBe(true);
  });

  it('rejects a forged From: attacker passes DKIM and SPF for their own domain', () => {
    const forged =
      'mx.google.com; dkim=pass header.d=evil.example header.s=k1; spf=pass smtp.mailfrom=bot@evil.example; dmarc=pass header.from=evil.example';
    expect(authenticated(forged, 'drops@nike.com')).toBe(false);
    expect(matchSender('drops@nike.com')?.name).toBe('Nike'); // it would have been read as Nike before the fix
  });

  it('rejects look-alike domains', () => {
    expect(authenticated('mx.google.com; dkim=pass header.d=notnike.com', 'news@nike.com')).toBe(false);
    expect(authenticated('mx.google.com; dkim=pass header.d=nike.com.evil.example', 'news@nike.com')).toBe(false);
  });

  it('rejects failures, a missing header and a missing From', () => {
    expect(authenticated('mx.google.com; dkim=fail header.d=nike.com; spf=softfail smtp.mailfrom=a@nike.com', 'a@nike.com')).toBe(false);
    expect(authenticated('', 'a@nike.com')).toBe(false);
    expect(authenticated('mx.google.com; dkim=pass header.d=nike.com', '')).toBe(false);
  });

  it('ignores a pass with no domain to compare', () => {
    expect(authenticated('mx.google.com; dkim=pass', 'a@nike.com')).toBe(false);
  });
});

describe('aligned', () => {
  it('matches equal and parent/child domains only', () => {
    expect(aligned('Nike.com', 'nike.com')).toBe(true);
    expect(aligned('e.nike.com', 'nike.com')).toBe(true);
    expect(aligned('nike.com', 'xnike.com')).toBe(false);
    expect(aligned('', 'nike.com')).toBe(false);
  });
});

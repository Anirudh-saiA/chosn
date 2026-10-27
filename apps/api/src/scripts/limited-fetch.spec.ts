import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchLimited } from './limited-fetch';

let server: Server;
let base = '';
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/ok') return void res.end('<rss>fine</rss>');
    if (req.url === '/404') return void res.writeHead(404).end();
    if (req.url === '/big') return void res.end('x'.repeat(5000));
    if (req.url === '/stall') return void res.writeHead(200).write('<rss>'); // never ends
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('fetchLimited', () => {
  it('returns the text of a normal response', async () => {
    expect(await fetchLimited(`${base}/ok`)).toEqual({ ok: true, status: 200, text: '<rss>fine</rss>' });
  });
  it('reports a bad status without throwing', async () => {
    expect((await fetchLimited(`${base}/404`)).ok).toBe(false);
  });
  it('refuses a body over the size limit', async () => {
    await expect(fetchLimited(`${base}/big`, {}, { maxBytes: 1000 })).rejects.toThrow(/too large/);
  });
  it('gives up on a response that never finishes', async () => {
    await expect(fetchLimited(`${base}/stall`, {}, { timeoutMs: 300 })).rejects.toThrow();
  });
});

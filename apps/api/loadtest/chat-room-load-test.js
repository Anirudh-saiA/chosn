/**
 * Day 23, task 4 — a concurrent-user spike against a single drop chat
 * room, the highest-risk real-time surface in this codebase (a hyped
 * drop can bring hundreds of people into one WebSocket room at once,
 * all sharing ChatGateway's in-memory `roomMembers` Set and Day 22's
 * per-user Redis rate limiter).
 *
 * Plain Node + the `ws` package this app already depends on, not k6 —
 * this environment has no k6 binary installed, and a hand-rolled
 * WebSocket harness is a legitimate "WebSocket-capable load tool" per
 * the brief's own wording; it also lets the test assert on this
 * gateway's actual frame shapes (`chat:message`/`chat:error`) directly,
 * which a generic k6 script would have to reimplement anyway.
 *
 * Shape of the simulated spike, deliberately not "N identical
 * senders" — a real drop chat is mostly lurkers:
 *   - SENDERS authenticated connections that actively post, some
 *     fast enough to exceed Day 22's 10 msg/min per-user limit on
 *     purpose, to prove the limiter actually holds under concurrent
 *     load rather than just in a single-connection test.
 *   - VIEWERS anonymous connections that only join and receive —
 *     the realistic bulk of a room's concurrent count, and what
 *     actually stresses `broadcastToRoom`'s per-client fan-out loop.
 *
 * While the spike runs, a separate poller hits an unrelated endpoint
 * (`GET /community/posts`) to confirm the rest of the app doesn't
 * degrade just because one room is under load (task 4's third
 * requirement) — this API process is single-threaded Node, so a
 * blocking hot loop anywhere in the broadcast path would show up here
 * as rising latency on completely unrelated requests.
 *
 * Usage: node chat-room-load-test.js [senders] [viewers] [durationSec]
 * Defaults: 50 senders, 250 viewers, 60s — ~300 concurrent connections
 * into one room, a plausible upper bound for this product's current
 * scale (see docs/community/README.md's own "today's scale" framing
 * on DropLiveGateway's global-broadcast decision).
 */
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');

const API = process.env.LOADTEST_API_URL || 'http://localhost:4000';
const WS_URL = API.replace(/^http/, 'ws') + '/ws/chat';
const SECRET = process.env.API_JWT_SECRET;
const PG_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/chosn_dev';

const SENDERS = Number(process.argv[2] || 50);
const VIEWERS = Number(process.argv[3] || 250);
const DURATION_MS = Number(process.argv[4] || 60) * 1000;
const RATE_LIMIT_PER_MINUTE = 10; // must match ChatGateway's own constant

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function main() {
  if (!SECRET) throw new Error('API_JWT_SECRET must be set in the environment running this script');

  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();

  console.log(`Chat load test: ${SENDERS} senders + ${VIEWERS} viewers = ${SENDERS + VIEWERS} concurrent connections, ${DURATION_MS / 1000}s, against ${WS_URL}`);

  // ---- room + test users -------------------------------------------------
  const dropRow = await pg.query('SELECT id FROM drop_events LIMIT 1');
  if (dropRow.rows.length === 0) throw new Error('no drop_events row to attach a test chat room to — seed one first');
  const dropEventId = dropRow.rows[0].id;

  let roomRow = await pg.query('SELECT id FROM chat_rooms WHERE drop_event_id = $1', [dropEventId]);
  let roomId;
  if (roomRow.rows.length === 0) {
    roomId = (
      await pg.query(`INSERT INTO chat_rooms (drop_event_id, status, opens_at) VALUES ($1, 'open', now() - interval '1 hour') RETURNING id`, [dropEventId])
    ).rows[0].id;
  } else {
    roomId = roomRow.rows[0].id;
    await pg.query(`UPDATE chat_rooms SET status = 'open' WHERE id = $1`, [roomId]);
  }

  const senderIds = Array.from({ length: SENDERS }, () => randomUUID());
  const values = senderIds.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, 'Load Sender', 'loadseed', now())`).join(',');
  const params = senderIds.flatMap((id, i) => [id, `loadtest-sender-${i}-${Date.now()}@test.local`]);
  await pg.query(`INSERT INTO users (id, email, display_name, avatar_seed, created_at) VALUES ${values}`, params);
  const emails = params.filter((_, i) => i % 2 === 1);
  const tokens = senderIds.map((id, i) => jwt.sign({ sub: id, email: emails[i] }, SECRET, { algorithm: 'HS256', expiresIn: '1h' }));

  // ---- background poller: is the rest of the app still healthy? ---------
  const pollerLatencies = [];
  let pollerErrors = 0;
  let pollerRunning = true;
  const poller = (async () => {
    while (pollerRunning) {
      const start = Date.now();
      try {
        const res = await fetch(`${API}/community/posts?limit=5`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) pollerErrors++;
        pollerLatencies.push(Date.now() - start);
      } catch {
        pollerErrors++;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  })();

  // ---- connect everyone ---------------------------------------------------
  const sendLatencies = []; // ms between a sender's send and every receiving client's frame
  let sent = 0;
  let delivered = 0;
  let rateLimited = 0;
  let connectFailures = 0;
  const sockets = [];
  const pendingSends = new Map(); // a coarse client-side sentAt marker, keyed by message body (unique per send)

  function makeViewer() {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'chat:join', roomId }));
        resolve(ws);
      });
      ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.type === 'chat:message' && parsed.roomId === roomId) {
            delivered++;
            const marker = pendingSends.get(parsed.message.body);
            if (marker) sendLatencies.push(Date.now() - marker);
          }
        } catch {
          /* ignore */
        }
      });
      ws.on('error', () => {
        connectFailures++;
        resolve(ws);
      });
    });
  }

  console.log('connecting...');
  const connectStart = Date.now();
  for (let i = 0; i < VIEWERS; i++) sockets.push(await makeViewer());
  const senderSockets = [];
  for (let i = 0; i < SENDERS; i++) {
    const ws = new WebSocket(`${WS_URL}?token=${tokens[i]}`);
    await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'chat:join', roomId }));
        resolve();
      });
      ws.on('error', () => {
        connectFailures++;
        resolve();
      });
    });
    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === 'chat:message' && parsed.roomId === roomId) {
          delivered++;
          const marker = pendingSends.get(parsed.message.body);
          if (marker) sendLatencies.push(Date.now() - marker);
        } else if (parsed.type === 'chat:error' && /too fast/i.test(parsed.message)) {
          rateLimited++;
        }
      } catch {
        /* ignore */
      }
    });
    senderSockets.push(ws);
    sockets.push(ws);
  }
  console.log(`connected ${sockets.length}/${SENDERS + VIEWERS} in ${Date.now() - connectStart}ms (${connectFailures} failures)`);

  // ---- drive the spike: each sender tries to send faster than the
  // 10/min limit allows, on purpose, to prove the limiter holds under
  // concurrent load, not just for one connection in isolation. ----------
  const sendIntervalMs = 2000; // 30/min attempted per sender — 3x the allowed rate
  const spikeEnd = Date.now() + DURATION_MS;
  const senderLoops = senderSockets.map((ws, i) =>
    (async () => {
      while (Date.now() < spikeEnd) {
        if (ws.readyState === WebSocket.OPEN) {
          const body = `load test message ${i}-${sent}-${randomUUID()}`;
          pendingSends.set(body, Date.now());
          ws.send(JSON.stringify({ type: 'chat:send', roomId, body }));
          sent++;
        }
        await new Promise((r) => setTimeout(r, sendIntervalMs + Math.random() * 400));
      }
    })(),
  );

  await Promise.all(senderLoops);
  await new Promise((r) => setTimeout(r, 3000)); // drain in-flight broadcasts
  pollerRunning = false;
  await poller;

  for (const ws of sockets) ws.close();

  // ---- results --------------------------------------------------------
  const sortedLat = sendLatencies.slice().sort((a, b) => a - b);
  const sortedPoll = pollerLatencies.slice().sort((a, b) => a - b);
  const expectedAllowedPerSender = Math.ceil((DURATION_MS / 60000) * RATE_LIMIT_PER_MINUTE) + 1; // +1 grace for the window boundary

  console.log('\n================ RESULTS ================');
  console.log(`connections:        ${SENDERS} senders + ${VIEWERS} viewers, ${connectFailures} connect failures`);
  console.log(`messages sent:      ${sent}`);
  console.log(`broadcast deliveries observed: ${delivered}`);
  console.log(`rate-limited sends: ${rateLimited} (expected: senders attempting ~${Math.round(DURATION_MS / sendIntervalMs)} each, limit is ${RATE_LIMIT_PER_MINUTE}/min)`);
  console.log(`broadcast latency (send -> received by another client), ms:`);
  console.log(`  min ${sortedLat[0] ?? 'n/a'}  p50 ${percentile(sortedLat, 0.5) ?? 'n/a'}  p95 ${percentile(sortedLat, 0.95) ?? 'n/a'}  max ${sortedLat[sortedLat.length - 1] ?? 'n/a'}`);
  console.log(`unrelated endpoint (GET /community/posts) during the spike:`);
  console.log(`  requests ${pollerLatencies.length}, errors ${pollerErrors}`);
  console.log(`  latency ms: min ${sortedPoll[0] ?? 'n/a'}  p50 ${percentile(sortedPoll, 0.5) ?? 'n/a'}  p95 ${percentile(sortedPoll, 0.95) ?? 'n/a'}  max ${sortedPoll[sortedPoll.length - 1] ?? 'n/a'}`);
  console.log('===========================================\n');

  const rateLimiterHeld = rateLimited > 0; // some sends must have been blocked, given senders exceed the limit on purpose
  console.log(rateLimiterHeld ? 'PASS: rate limiter engaged under concurrent load' : 'FAIL: rate limiter never engaged — check ChatGateway.underRateLimit / Redis');
  console.log(pollerErrors === 0 ? 'PASS: unrelated endpoint saw zero errors during the spike' : `FAIL: unrelated endpoint saw ${pollerErrors} errors during the spike`);

  // cleanup
  await pg.query('DELETE FROM chat_messages WHERE author_user_id = ANY($1)', [senderIds]);
  await pg.query('DELETE FROM user_reputation WHERE user_id = ANY($1)', [senderIds]);
  await pg.query('DELETE FROM users WHERE id = ANY($1)', [senderIds]);
  await pg.end();
}

main().catch((err) => {
  console.error('LOAD TEST ERROR:', err);
  process.exit(1);
});

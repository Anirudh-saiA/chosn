#!/usr/bin/env node
// Local mock of the CHOSN API (apps/api) for UI work. Dependency-free.
//   node dev/mock-api.mjs          (PORT=4000 by default)
// Shapes mirror the TS interfaces in apps/web/src/lib/*. State is in-memory.
import http from 'node:http';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.PORT || 4000);
const BOOT = Date.now();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

// ------------------------------------------------------------------ helpers
function uuid(seed) {
  const h = createHash('sha1').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function rngFor(seed) {
  let a = parseInt(createHash('md5').update(String(seed)).digest('hex').slice(0, 8), 16) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

// ------------------------------------------------------------------ catalog
// [styleCode, brand, model, colorway, silhouette, gender, retailINR, marketMultiplier, trendPct, signal, hype 0..1]
const S = 'good_time_to_buy', N = 'neutral', W = 'consider_waiting', I = 'insufficient_data';
const SNEAKER_ROWS = [
  ['DD1391-100', 'Nike', 'Dunk Low Retro', 'White/Black (Panda)', 'Dunk Low', 'unisex', 10795, 1.08, -7.4, S, 0.55],
  ['DD1391-103', 'Nike', 'Dunk Low Retro', 'Photon Dust/Grey Fog', 'Dunk Low', 'men', 10795, 1.02, 0.8, N, 0.35],
  ['DZ5485-612', 'Nike', 'Air Jordan 1 Retro High OG', 'Chicago Lost & Found', 'Air Jordan 1', 'men', 17995, 1.62, 9.6, W, 0.95],
  ['CW2288-111', 'Nike', "Air Force 1 '07", 'Triple White', 'Air Force 1', 'unisex', 9495, 0.98, -1.2, N, 0.1],
  ['CN8490-100', 'Nike', 'Air Max 90', 'White/Wolf Grey', 'Air Max 90', 'men', 13495, 1.0, -4.9, S, 0.2],
  ['BQ6817-500', 'Nike', 'SB Dunk Low Pro', 'Court Purple', 'SB Dunk Low', 'unisex', 10295, 1.34, 6.2, W, 0.7],
  ['DQ3989-100', 'Nike', "Air Max 1 '86 OG", 'Big Bubble White/Red', 'Air Max 1', 'men', 15995, 1.18, 0.4, N, 0.5],
  ['FD0736-100', 'Nike', 'Zoom Vomero 5', 'Photon Dust', 'Vomero 5', 'unisex', 13995, 1.12, 5.4, W, 0.6],
  ['DH6927-111', 'Jordan', 'Air Jordan 4 Retro', 'Military Black', 'Air Jordan 4', 'men', 19995, 1.45, -8.3, S, 0.85],
  ['DN3707-100', 'Jordan', 'Air Jordan 3 Retro', 'White Cement Reimagined', 'Air Jordan 3', 'men', 18995, 1.38, 1.1, N, 0.8],
  ['B75806', 'adidas', 'Samba OG', 'Cloud White/Core Black/Gum', 'Samba', 'unisex', 10999, 1.05, -2.1, N, 0.4],
  ['HQ8708', 'adidas', 'Campus 00s', 'Core Black/Cloud White', 'Campus', 'unisex', 9999, 0.97, -5.6, S, 0.3],
  ['BB5476', 'adidas', 'Gazelle', 'Core Black/White', 'Gazelle', 'unisex', 9999, 1.0, 0.0, N, 0.25],
  ['BD7633', 'adidas', 'Handball Spezial', 'Navy/Gum', 'Spezial', 'unisex', 10999, 1.04, 7.8, W, 0.45],
  ['HQ6448', 'adidas', 'Yeezy Slide', 'Onyx', 'Yeezy Slide', 'unisex', 8999, 1.22, -3.3, S, 0.5],
  ['BB550WT1', 'New Balance', '550', 'White/Green', '550', 'unisex', 11999, 1.03, -1.5, N, 0.35],
  ['U990GR6', 'New Balance', '990v6', 'Grey', '990', 'unisex', 21999, 0.99, -6.1, S, 0.3],
  ['ML2002RA', 'New Balance', '2002R', 'Protection Pack Rain Cloud', '2002R', 'unisex', 15999, 1.1, 3.9, N, 0.5],
  ['U9060ECA', 'New Balance', '9060', 'Sea Salt', '9060', 'unisex', 15999, 1.07, 0, I, 0.5],
  ['398846-01', 'Puma', 'Speedcat OG', 'Puma Black/Puma White', 'Speedcat', 'unisex', 9999, 1.15, 0, I, 0.55],
  ['1201A019-108', 'ASICS', 'Gel-Kayano 14', 'White/Midnight', 'Gel-Kayano', 'unisex', 14999, 1.09, 4.4, N, 0.6],
  ['162050C', 'Converse', 'Chuck 70 High Top', 'Black', 'Chuck 70', 'unisex', 6999, 0.96, -3.8, S, 0.15],
  ['VN000D3HY28', 'Vans', 'Old Skool', 'Black/White', 'Old Skool', 'unisex', 6499, 0.95, 0.6, N, 0.1],
  ['L41086600', 'Salomon', 'XT-6', 'Black/Phantom/Lunar Rock', 'XT-6', 'unisex', 18999, 1.1, 10.2, W, 0.6],
];
const SIZES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12];
const SIZE_SYSTEM = 'UK';
const SNEAKERS = SNEAKER_ROWS.map(([styleCode, brand, model, colorway, silhouette, gender, retail, mult, trend, signal, hype]) => ({
  styleCode, brand, model, colorway, silhouette, gender, retail, mult, trend, signal, hype, primaryImageUrl: null,
}));
const BY_CODE = new Map(SNEAKERS.map((s) => [s.styleCode, s]));
const variantId = (code, size) => uuid(`variant:${code}:${size}`);
const VARIANT_INDEX = new Map();
for (const s of SNEAKERS) for (const z of SIZES) VARIANT_INDEX.set(variantId(s.styleCode, z), { sneaker: s, size: z });

const RETAILERS = {
  flipkart: { name: 'Flipkart', f: 1.0, ship: 0, cond: 'new', url: (c) => `https://www.flipkart.com/search?q=${c}` },
  myntra: { name: 'Myntra', f: 1.01, ship: 0, cond: 'new', url: (c) => `https://www.myntra.com/sneakers?rawQuery=${c}` },
  ajio: { name: 'Ajio', f: 0.97, ship: 0, cond: 'new', url: (c) => `https://www.ajio.com/search/?text=${c}` },
  'end-clothing': { name: 'END. Clothing', f: 1.09, ship: 1199, cond: 'new', url: (c) => `https://www.endclothing.com/in/catalogsearch/result?q=${c}` },
  'culture-circle': { name: 'Culture Circle', f: 1.16, ship: 0, cond: 'new', resale: true, url: (c) => `https://culturecircle.com/search?q=${c}` },
  superkicks: { name: 'Superkicks', f: 1.03, ship: 99, cond: 'new', url: (c) => `https://www.superkicks.in/search?q=${c}` },
  vegnonveg: { name: 'VegNonVeg', f: 1.05, ship: 0, cond: 'new', url: (c) => `https://www.vegnonveg.com/search?q=${c}` },
};

function buildOffers(s, size) {
  const now = Date.now();
  const r = rngFor(`offers:${s.styleCode}:${size}`);
  const market = s.retail * s.mult * (1 + (r() - 0.5) * 0.05);
  const slugs = Object.keys(RETAILERS).filter((k) => k === 'culture-circle' ? (s.hype > 0.4 || r() > 0.5) : r() > 0.3);
  while (slugs.length < 4) { const k = Object.keys(RETAILERS)[Math.floor(r() * 7)]; if (!slugs.includes(k)) slugs.push(k); }
  return slugs.map((slug) => {
    const R = RETAILERS[slug];
    const resaleBump = R.resale ? 1 + s.hype * 0.25 : 1;
    const raw = market * R.f * resaleBump * (1 + (r() - 0.5) * 0.06);
    const price = R.resale ? Math.round(raw / 500) * 500 : Math.round(raw / 100) * 100 - 5;
    const manual = slug === 'end-clothing' || (slug === 'vegnonveg' && r() > 0.5);
    const freq = manual ? 1440 : [60, 120, 360][Math.floor(r() * 3)];
    const ageMin = Math.floor(r() * (manual ? 2400 : 300)) + 4;
    return {
      retailerSlug: slug, retailerName: R.name, retailerLogoUrl: null,
      price, shippingCost: R.ship, currency: 'INR', effectivePriceInr: price + R.ship,
      condition: R.resale ? 'new' : 'new', inStock: r() > 0.16,
      listingUrl: R.url(s.styleCode), imageUrl: null,
      fetchedAt: iso(now - ageMin * MIN), fetchFrequencyMinutes: freq,
      isStale: ageMin > freq * 2, mode: manual ? 'manual' : 'live',
    };
  }).sort((a, b) => (a.effectivePriceInr ?? 0) - (b.effectivePriceInr ?? 0));
}

function buildIntel(s, size, offers) {
  const inStock = offers.filter((o) => o.inStock);
  const pool = inStock.length ? inStock : offers;
  const best = pool[0];
  const current = pool.find((o) => !RETAILERS[o.retailerSlug].resale) ?? pool[0];
  const r = rngFor(`intel:${s.styleCode}:${size}`);
  const insufficient = s.signal === I;
  const trend = insufficient ? null : Math.round((s.trend + (r() - 0.5) * 0.8) * 10) / 10;
  const avg30 = insufficient ? null : Math.round(current.price / (1 + trend / 100));
  const avg90 = insufficient ? null : Math.round(avg30 * (1 + (r() - 0.4) * 0.05));
  return {
    sneakerVariantId: variantId(s.styleCode, size),
    currentPrice: current.price, currentRetailerId: uuid(`retailer:${current.retailerSlug}`), currentRetailerSlug: current.retailerSlug,
    bestAvailablePrice: best.price, bestRetailerId: uuid(`retailer:${best.retailerSlug}`), bestRetailerSlug: best.retailerSlug,
    avg30d: avg30, avg90d: avg90, trendPct: trend, signal: s.signal,
    daysHistory30d: insufficient ? 4 : 27 + Math.floor(r() * 4), daysHistory90d: insufficient ? 4 : 71 + Math.floor(r() * 19),
    sufficientData: !insufficient, currency: 'INR', computedAt: iso(Date.now() - Math.floor(r() * 50 + 3) * MIN),
  };
}

const sneakerOut = (s) => ({ styleCode: s.styleCode, brand: s.brand, model: s.model, colorway: s.colorway, silhouette: s.silhouette, gender: s.gender, primaryImageUrl: null });

function catalogVariant(code, sizeStr) {
  const s = BY_CODE.get(code);
  const size = Number(sizeStr);
  if (!s || !SIZES.includes(size)) return null;
  const offers = buildOffers(s, size);
  return {
    sneaker: sneakerOut(s),
    variant: { id: variantId(code, size), size, sizeSystem: SIZE_SYSTEM, region: 'IN' },
    siblingSizes: SIZES.map((z) => ({ size: z, sizeSystem: SIZE_SYSTEM })),
    offers, marketIntelligence: buildIntel(s, size, offers),
  };
}

function searchCatalog(q, brand, signal, limit, offset) {
  const tokens = (q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (s) => `${s.brand} ${s.model} ${s.colorway} ${s.silhouette} ${s.styleCode}`.toLowerCase();
  const byQ = SNEAKERS.filter((s) => tokens.every((t) => hay(s).includes(t)));
  const filtered = byQ.filter((s) => (!brand || s.brand.toLowerCase() === brand.toLowerCase()) && (!signal || s.signal === signal));
  const results = filtered.slice(offset, offset + limit).map((s) => {
    const v = catalogVariant(s.styleCode, 9);
    return {
      styleCode: s.styleCode, brand: s.brand, model: s.model, colorway: s.colorway, silhouette: s.silhouette, primaryImageUrl: null,
      defaultSize: 9, defaultSizeSystem: SIZE_SYSTEM,
      currentPrice: v.marketIntelligence.currentPrice, bestAvailablePrice: v.marketIntelligence.bestAvailablePrice,
      signal: s.signal, currency: 'INR',
    };
  });
  const brands = [...new Set(byQ.map((s) => s.brand))].sort();
  const communityPosts = tokens.length
    ? [...posts.values()].filter((p) => tokens.every((t) => `${p.title ?? ''} ${p.body ?? ''} ${p.sneaker?.model ?? ''}`.toLowerCase().includes(t)))
        .slice(0, 5).map((p) => ({ id: p.id, postType: p.postType, title: p.title, preview: ((p.title ? p.title + ' — ' : '') + (p.body ?? '')).slice(0, 160), authorDisplayName: userOf(p.authorUserId)?.displayName ?? null, createdAt: p.createdAt }))
    : [];
  return { results, total: filtered.length, brands, communityPosts };
}

// ------------------------------------------------------------------ users / reputation
// [key, displayName, accountAgePoints, helpfulVotePoints, verifiedPurchasePoints, helpfulVotesReceived, verifiedPurchaseCount, accountAgeDays]
const USER_ROWS = [
  ['aarav', 'aarav.kicks', 30, 38, 16, 61, 4, 640],
  ['meher', 'meher_solecollective', 30, 30, 11, 49, 3, 590],
  ['rohan', 'rohan_deadstock', 26, 22, 10, 37, 3, 470],
  ['zoya', 'zoya.on.feet', 22, 18, 6, 30, 2, 380],
  ['kabir', 'kabir_resells', 18, 11, 4, 19, 1, 310],
  ['ishita', 'ishita.sneakerhead', 14, 9, 4, 15, 1, 260],
  ['dev', 'devtheDunker', 11, 6, 2, 10, 1, 190],
  ['tanvi', 'tanvi_t', 8, 3, 1, 5, 0, 140],
  ['arjun', 'arjun.sb', 6, 2, 0, 3, 0, 95],
  ['nisha', 'nisha_in_nb', 4, 1, 0, 2, 0, 60],
  ['yash', 'yash_grails', 2, 0, 0, 0, 0, 24],
  ['sana', 'sana_lace_up', 1, 0, 0, 0, 0, 9],
];
const users = new Map();
for (const [key, displayName, ap, hp, vp, hv, vc, ageDays] of USER_ROWS) {
  const id = uuid(`user:${key}`);
  users.set(id, {
    id, displayName, avatarSeed: `${key}-${id.slice(0, 6)}`,
    ap, hp, vp, hv, vc, accountCreatedAt: iso(BOOT - ageDays * DAY),
  });
}
const U = (key) => uuid(`user:${key}`);
const userOf = (id) => users.get(id);
const scoreOf = (u) => (u ? u.ap + u.hp + u.vp : 0);
function ensureUser(id, displayName) {
  if (!users.has(id)) users.set(id, { id, displayName: displayName || 'you', avatarSeed: `viewer-${id.slice(0, 6)}`, ap: 4, hp: 3, vp: 0, hv: 2, vc: 0, accountCreatedAt: iso(BOOT - 30 * DAY) });
  return users.get(id);
}
function reputationOf(id) {
  const u = userOf(id);
  if (!u) return null;
  return {
    reputation: {
      userId: u.id, score: scoreOf(u), accountAgePoints: u.ap, helpfulVotePoints: u.hp, verifiedPurchasePoints: u.vp,
      helpfulVotesReceived: u.hv, verifiedPurchaseCount: u.vc, accountCreatedAt: u.accountCreatedAt, lastCalculatedAt: iso(Date.now() - 2 * HOUR),
    },
    user: { displayName: u.displayName, avatarSeed: u.avatarSeed },
  };
}

// ------------------------------------------------------------------ drops
function istNow() { return new Date(Date.now() + 5.5 * HOUR); }
function istDateOffset(days) { return new Date(istNow().getTime() + days * DAY).toISOString().slice(0, 10); }
// [key, styleCode, status, dayOffset, time, regions, retailPrice, links, raffle (closesInDays|null, method)]
const DROP_ROWS = [
  ['aj1-chicago', 'DZ5485-612', 'live', 0, 'now', ['india', 'global'], '17995.00', [['Nike SNKRS India', 'https://www.nike.com/in/launch', 'india'], ['Superkicks', 'https://www.superkicks.in/collections/jordan', 'india']], null],
  ['campus-raffle', 'HQ8708', 'live', 0, 'now', ['india'], '9999.00', [['adidas Confirmed', 'https://www.adidas.co.in/confirmed', 'india']], [-0.1, 'App draw — winners notified by push']],
  ['dunk-panda', 'DD1391-100', 'upcoming', 2, '15:30:00', ['india'], '10795.00', [['Nike.com India', 'https://www.nike.com/in/launch', 'india'], ['Myntra', 'https://www.myntra.com/nike-dunk', 'india']], null],
  ['nb9060', 'U9060ECA', 'upcoming', 4, '11:00:00', ['india'], '15999.00', [['Superkicks', 'https://www.superkicks.in/collections/new-balance', 'india']], [3, 'In-store and online raffle — pick up at Superkicks']],
  ['aj4-military', 'DH6927-111', 'upcoming', 7, '17:00:00', ['india', 'us'], '19995.00', [['VegNonVeg', 'https://www.vegnonveg.com/raffles', 'india'], ['Nike SNKRS', 'https://www.nike.com/launch', 'us']], [6, 'Online raffle — one entry per person, ID check on pickup']],
  ['speedcat', '398846-01', 'upcoming', 9, '12:00:00', ['india', 'global'], '9999.00', [['Puma India', 'https://in.puma.com/in/en/speedcat', 'india']], null],
  ['vomero5', 'FD0736-100', 'upcoming', 14, '10:30:00', ['india'], '13995.00', [['Nike.com India', 'https://www.nike.com/in/launch', 'india']], null],
  ['xt6', 'L41086600', 'upcoming', 21, '13:00:00', ['india'], '18999.00', [['Superkicks', 'https://www.superkicks.in', 'india'], ['Salomon India', 'https://www.salomon.com/en-in', 'india']], [19, 'Raffle via Salomon India app']],
  ['am1-bubble', 'DQ3989-100', 'upcoming', 30, null, ['global'], '15995.00', [['Nike SNKRS', 'https://www.nike.com/launch', 'global']], null],
  ['sb-purple', 'BQ6817-500', 'sold_out', -1, '10:00:00', ['india'], '10295.00', [['Nike SB India', 'https://www.nike.com/in/sb', 'india']], [-2, 'Raffle closed — winners notified']],
  ['slide-onyx', 'HQ6448', 'sold_out', -5, '09:30:00', ['india', 'global'], '8999.00', [['adidas India', 'https://www.adidas.co.in/yeezy', 'india']], null],
  ['aj3-cement', 'DN3707-100', 'sold_out', -12, '16:00:00', ['india', 'us'], '18995.00', [['Nike SNKRS India', 'https://www.nike.com/in/launch', 'india']], [-13, 'Raffle closed']],
];
function dropRows() {
  return DROP_ROWS.map(([key, code, status, off, time, regions, retail, links, raffle]) => {
    let date = istDateOffset(off), t = time;
    if (time === 'now') { const d = new Date(istNow().getTime() - 90 * MIN); date = d.toISOString().slice(0, 10); t = d.toISOString().slice(11, 19); }
    const releaseMs = time && time !== 'now' ? Date.parse(`${date}T${t}+05:30`) : time === 'now' ? Date.now() - 90 * MIN : Date.parse(`${date}T00:00:00+05:30`);
    return {
      key, id: uuid(`drop:${key}`), code, status, releaseDate: date, releaseTime: t, releaseTimezone: 'Asia/Kolkata', regions, retailPrice: retail, currency: 'INR',
      purchaseLinks: links.map(([retailer_name, url, region]) => ({ retailer_name, url, region })),
      raffleInfo: raffle ? { registration_url: links[0][1], registration_closes_at: iso(Date.now() + raffle[0] * DAY), method: raffle[1] } : null,
      releaseMs,
    };
  });
}
const dropSneaker = (code) => { const s = BY_CODE.get(code); return { styleCode: s.styleCode, brand: s.brand, model: s.model, colorway: s.colorway, primaryImageUrl: null }; };
const dropListItem = (d) => ({ id: d.id, status: d.status, releaseDate: d.releaseDate, releaseTime: d.releaseTime, releaseTimezone: d.releaseTimezone, regions: d.regions, retailPrice: d.retailPrice, currency: d.currency, sneaker: dropSneaker(d.code) });
const findDrop = (id) => dropRows().find((d) => d.id === id);

// ------------------------------------------------------------------ news
const NEWS_ROWS = [
  ['Air Jordan 1 "Chicago Lost & Found" hits India: Nike confirms same-day SNKRS drop', 'Nike SNKRS India has confirmed the Chicago colourway will launch on the app with FCFS access. Expect it to sell out in seconds; the vintage-aged leather and cracked midsole treatment make this the most contested Jordan 1 of the year. Superkicks will run a parallel in-store queue in Mumbai and Bengaluru.', 'Sneaker News India', 'https://www.nike.com/in/launch', true, 35, 'aj1-chicago'],
  ['adidas Campus 00s Confirmed raffle is open now, closing tonight', 'The Campus 00s in Core Black is live on the adidas Confirmed app as a draw. Entries close at 11:59 PM IST and winners get a push notification within the hour. The silhouette has been the surprise hit of the season, outpacing even the Samba on resale demand.', 'Hypefeed', 'https://www.adidas.co.in/confirmed', false, 140, 'campus-raffle'],
  ['Dunk Low "Panda" restock confirmed for Thursday, and retailers are prepping for scale', 'Another Panda restock, but this one is reportedly deeper than the last. Nike.com India and Myntra will both receive stock at 3:30 PM. Resale has dipped below retail on some sizes, so if you have been waiting, this is your window.', 'Sole Digest', null, false, 260, 'dunk-panda'],
  ['New Balance 9060 "Sea Salt" gets a Superkicks-exclusive raffle', 'The chunky 9060 is coming to India through a raffle format for the first time. Registration is open at Superkicks and entries are limited to one per person, with pickup verified against a government ID.', 'Sneaker News India', 'https://www.superkicks.in/collections/new-balance', false, 410, 'nb9060'],
  ['Jordan 4 "Military Black" returns: everything to know before the raffle', 'The Military Black is back with the sail-and-black palette and Nike Air branding on the heel. Retail is ₹19,995 and VegNonVeg is running the Indian raffle. Historic resale suggests a healthy premium, but the pair sits in "good time to buy" territory on the aftermarket for now.', 'Hypefeed', 'https://www.vegnonveg.com/raffles', false, 600, 'aj4-military'],
  ['Puma Speedcat OG is back and it is bigger than the hype suggests', 'Motorsport-inspired low profiles keep dominating. Puma brings the Speedcat OG to India with a lean release, and stock will be tight. Sizing runs narrow, so most testers recommend going half a size up.', 'Sole Digest', 'https://in.puma.com/in/en/speedcat', false, 900, 'speedcat'],
  ['Price watch: Air Force 1 and Vans Old Skool hold steady while the Samba cools off', 'Our tracked retailers show the classic workhorse silhouettes remain flat, while Samba OG prices have eased about 2% over 30 days as supply catches up. Meanwhile Air Max 90 has slipped below its 90-day average, one of the clearer buy signals this month.', 'CHOSN Market Desk', null, false, 1300, null],
  ['SB Dunk Low "Court Purple" sold out in under four minutes', 'The Court Purple SB restock vanished across every Indian retailer within minutes of the 10 AM release. Aftermarket listings on Culture Circle are already trading roughly a third above retail.', 'Hypefeed', null, false, 1700, 'sb-purple'],
  ['Salomon XT-6 raffle announced as trail-runner crossover keeps climbing', 'Salomon will run an app raffle for the XT-6 Black Phantom with Superkicks handling select allocations. Salomon India says this is its largest sneaker-focused allocation yet, though the sizing curve will skew towards the mid-range.', 'Sneaker News India', 'https://www.salomon.com/en-in', false, 2300, 'xt6'],
  ['Yeezy Slide "Onyx" clears out after a quiet FCFS drop', 'Not every drop is a bloodbath. The Yeezy Slide Onyx lasted several hours on adidas India, though most sizes sold out by evening. Resale is running modestly above retail.', 'Sole Digest', null, false, 7200, 'slide-onyx'],
];
const news = NEWS_ROWS.map(([title, body, source, sourceUrl, isBreaking, ageMin, dropKey], i) => {
  const d = dropKey ? DROP_ROWS.find((r) => r[0] === dropKey) : null;
  const s = d ? BY_CODE.get(d[1]) : null;
  return { id: uuid(`news:${i}`), title, body, source, sourceUrl, isBreaking, ageMin, dropEventId: d ? uuid(`drop:${dropKey}`) : null, dropSneaker: s ? { styleCode: s.styleCode, brand: s.brand, model: s.model } : null };
});
const newsOut = (n) => ({ id: n.id, title: n.title, body: n.body, source: n.source, sourceUrl: n.sourceUrl, isBreaking: n.isBreaking, publishedAt: iso(BOOT - n.ageMin * MIN), dropEventId: n.dropEventId, dropSneaker: n.dropSneaker });

// ------------------------------------------------------------------ community
const svg = (label, hue) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="hsl(${hue},14%,16%)"/><rect x="24" y="24" width="752" height="552" fill="none" stroke="hsl(${hue},30%,42%)" stroke-dasharray="6 8"/><text x="400" y="310" font-family="monospace" font-size="28" fill="hsl(${hue},20%,72%)" text-anchor="middle">${label}</text></svg>`)}`;
const CHECKLISTS = {
  jordan: ['Box label and style code', 'Tongue tag stitching', 'Heel embroidery', 'Insole print', 'Sole flex and stitching'],
  dunk: ['Box label', 'Tongue tag', 'Toe box perforation', 'Insole and stitching', 'Swoosh shape'],
};
const cl = (arr) => arr.map((label, i) => ({ id: `chk-${i + 1}`, label }));

// [key, type, author, code, size, title, body, ageMin, baseVotes, poll[cop,drop]|null, dropKey|null, extra]
const POST_ROWS = [
  ['p1', 'cop_or_drop', 'aarav', 'DD1391-100', 9, 'Panda Dunk at ₹10,795 restock: still a cop in 2026?', 'Third restock and everybody still owns a pair. Retail is fair, resale is below retail on my size. I want a beater pair that goes with everything. Cop or drop?', 95, 34, [142, 41], null],
  ['p2', 'price_check', 'meher', 'CN8490-100', 9, 'Air Max 90 dipped under ₹12,800, worth grabbing now?', 'Saw it drop on Ajio. The tracker says it is below the 90-day average. Is this the real low or does it go lower during the Big Billion sale?', 180, 27, null, null],
  ['p3', 'legit_check', 'rohan', 'DZ5485-612', 9, 'Legit check: Chicago Lost & Found from a Culture Circle resale', 'Picked this up from resale and want a second pair of eyes. The tongue tag stitching feels slightly tight to me and the heel embroidery looks fine. Photos attached for each checklist item.', 260, 45, null, null, { checklist: 'jordan', images: 3 }],
  ['p4', 'drop_talk', 'zoya', 'DZ5485-612', null, 'AJ1 Chicago SNKRS India: what is your strategy?', 'Going in with a fresh session and a backup card. Anyone got luck with the SNKRS Launch Access flow in India before? Drop is now live.', 40, 52, null, 'aj1-chicago'],
  ['p5', 'cop_or_drop', 'kabir', 'B75806', 8, 'Samba OG: overhyped or timeless?', 'Everyone and their cousin owns a pair. I am tempted by the black and gum but the toe box is narrow. Cop or drop at ₹10,999?', 330, 21, [88, 76], null],
  ['p6', 'price_check', 'ishita', 'U990GR6', 8, '990v6 grey under ₹21k, is this the floor?', 'Superkicks has it at ₹20,995 in my size. Trend says it is about 6% below the 30-day average. I have been waiting since January.', 500, 19, null, null],
  ['p7', 'drop_talk', 'dev', 'DH6927-111', null, 'AJ4 Military Black raffle at VegNonVeg: entries open', 'Registration closes in a few days. Reminder that one entry per person and they check ID on pickup. Last year the Bangalore store was a mess so plan your time.', 620, 38, null, 'aj4-military'],
  ['p8', 'legit_check', 'tanvi', 'DD1391-100', 8, 'Panda Dunk from an Instagram seller, please check', 'Price was ₹8,200 which felt suspiciously cheap. Box label seems okay but the toe box perforation looks off. Uploaded shots per the checklist.', 780, 12, null, null, { checklist: 'dunk', images: 2 }],
  ['p9', 'cop_or_drop', 'arjun', 'BQ6817-500', 9, 'SB Dunk Court Purple at resale prices?', 'Missed the drop. Resale asks are about a third over retail. I do skate them so they will get beaten up. Cop or drop?', 900, 15, [63, 97], null],
  ['p10', 'price_check', 'nisha', 'BB550WT1', 7, 'NB 550 white/green: ₹11,999 or wait for the sale?', 'Myntra shows it stable for a month. Prices always drop in the end-of-season sale but sizes vanish. Anyone tracked this?', 1100, 9, null, null],
  ['p11', 'drop_talk', 'meher', 'U9060ECA', null, 'NB 9060 Sea Salt raffle: how does the Superkicks process work?', 'First time doing a raffle in India. Do we need to pick up in store or do they ship? Also whether entering for multiple sizes counts as multiple entries.', 1300, 24, null, 'nb9060'],
  ['p12', 'cop_or_drop', 'zoya', 'HQ8708', 7, 'Campus 00s black, wear-with-everything sneaker?', 'Slim cut, suede upper, ₹9,999. Colour goes with baggy jeans and cargos. Would you cop?', 1500, 31, [174, 52], null],
  ['p13', 'price_check', 'yash', 'ML2002RA', 9, '2002R Rain Cloud, is ₹16k a fair price?', 'Retail is ₹15,999 but I only see it above that at most Indian sellers. Are import duties the reason?', 1800, 6, null, null],
  ['p14', 'legit_check', 'kabir', 'DH6927-111', 10, 'AJ4 Military Black, quick legit check before I pay', 'Seller on Culture Circle. Photos of each area are up. Feeling good about the shape of the netting but the box label font looks slightly thin.', 2100, 17, null, null, { checklist: 'jordan', images: 2 }],
  ['p15', 'drop_talk', 'ishita', 'FD0736-100', null, 'Vomero 5 Photon Dust: will Nike India restock?', 'Only saw it once on Myntra. If there is a restock scheduled I will hold off on resale. Anyone heard from a store manager?', 2500, 11, null, 'vomero5'],
  ['p16', 'cop_or_drop', 'dev', 'L41086600', 9, 'Salomon XT-6 for daily wear in Indian summers?', 'The gorpcore look is great but they look hot. Mesh upper, quicklace. ₹18,999 is steep though. Cop or drop?', 3000, 14, [58, 44], null],
  ['p17', 'price_check', 'aarav', 'HQ6448', 10, 'Yeezy Slide Onyx resale vs retail: is it worth it now?', 'Post-drop resale is a bit above retail. Should I wait for it to settle or grab a pair now?', 3600, 8, null, null],
  ['p18', 'cop_or_drop', 'sana', 'VN000D3HY28', 8, 'First sneaker purchase: Old Skool vs Chuck 70?', 'Total newbie. Both are around ₹6,500–7,000. Which one should I get first? I mostly walk around campus.', 4200, 5, [37, 29], null],
  ['p19', 'drop_talk', 'tanvi', 'DQ3989-100', null, 'Air Max 1 Big Bubble: TBA drop, any leaks on release time?', 'Heard rumours of a global drop only. If India has no allocation the only route is resale, which I would like to avoid.', 5000, 7, null, 'am1-bubble'],
  ['p20', 'price_check', 'nisha', '162050C', 9, 'Chuck 70 black high top, best price this month?', 'Converse discounts are all over the place. Ajio has it at ₹6,499 today. That seems to be the lowest this quarter.', 6000, 10, null, null],
];
const posts = new Map();
const commentsByPost = new Map();
const viewerVotes = new Map(); // `${type}:${id}` -> Map(viewerId -> 1|-1)
const pollVotes = new Map(); // postId -> Map(viewerId -> choice)
const baseVotes = new Map();

for (const [key, postType, author, code, size, title, body, ageMin, votes, poll, dropKey, extra] of POST_ROWS) {
  const id = uuid(`post:${key}`);
  const s = BY_CODE.get(code);
  const authorId = U(author);
  const isCat = postType === 'price_check' || postType === 'cop_or_drop' || postType === 'legit_check';
  const cat = size ? catalogVariant(code, size) : null;
  const dropRow = dropKey ? DROP_ROWS.find((r) => r[0] === dropKey) : null;
  let legit = null, images = null;
  if (extra?.checklist) {
    legit = cl(CHECKLISTS[extra.checklist]);
    images = legit.slice(0, extra.images).map((c, i) => ({ id: uuid(`img:${key}:${i}`), url: svg(c.label, 30 + i * 40), checklistItemId: c.id, classifierStatus: 'approved' }));
  }
  posts.set(id, {
    id, postType, title, body, authorUserId: authorId,
    createdAt: iso(BOOT - ageMin * MIN),
    sneaker: s ? { styleCode: s.styleCode, brand: s.brand, model: s.model, colorway: s.colorway } : null,
    variant: cat ? { id: cat.variant.id, size: String(size), sizeSystem: SIZE_SYSTEM } : null,
    intelCode: isCat && size ? [code, size] : null,
    poll: poll ? { cop: poll[0], drop: poll[1] } : null,
    legitCheckChecklist: legit, images, dropKey: dropRow ? dropRow[0] : null,
  });
  baseVotes.set(`post:${id}`, votes);
}

// [postKey, [ [author, text, minutesAfterPost], ... ]]
const COMMENT_ROWS = [
  ['p1', [['meher', 'Cop. It is the one shoe you will actually wear weekly. I have three restock pairs and none gave me any regret.', 20], ['kabir', 'Below retail resale means there is no scarcity premium left. Grab it if you like the look, do not expect a flip.', 55]]],
  ['p2', [['aarav', 'Big Billion usually gets Air Max 90 to about ₹11,500 but sizes 8–10 vanish early. If your size is there, buy.', 40], ['zoya', 'It was ₹12,495 last month on Myntra. So yes, this is a meaningful dip.', 90]]],
  ['p3', [['aarav', 'Tongue tag stitching on the retail pair is tight too. Compare to the second photo, the spacing between letters is the tell. Yours looks fine.', 30], ['meher', 'Heel embroidery is clean. Box label font matches. I would say legit, but wait for more opinions on the insole print.', 65], ['dev', 'Insole print is slightly faded on the right, which happens with the aged treatment on this pair. Nothing to worry about.', 120]]],
  ['p4', [['rohan', 'Update your app and payment method the night before. Use Wi-Fi not mobile data. That is all I can offer.', 8], ['kabir', 'Loading queue times out around the 30-second mark for me every time. Just keep retrying.', 15]]],
  ['p5', [['zoya', 'Toe box is narrow but stretches a bit with wear. Go half a size up if you have wide feet.', 45], ['ishita', 'Timeless. Trends will come and go but Samba has been around for decades.', 100]]],
  ['p6', [['aarav', 'Been tracking this exact colourway. It has not been lower than ₹20,500 in the past 90 days.', 60], ['rohan', '990v6 quality is worth it. Made in the USA versions are pricier but the Indian retail price is fine.', 130]]],
  ['p7', [['zoya', 'Thanks for the reminder. Bangalore store had a huge line last year, so I am going for Mumbai this time.', 30], ['meher', 'Enter early. Raffle order does not matter, but you can forget if you leave it to the last day.', 75]]],
  ['p8', [['aarav', 'Rule of thumb: ₹8,200 for a Panda that retails at ₹10,795 is too good to be true. Perforation looks uneven, I would return it.', 25], ['rohan', 'Agree with aarav. Swoosh also looks a bit thin near the tip.', 50]]],
  ['p9', [['dev', 'If you skate them, wait for a general release SB colourway. Paying a premium for a pair you will destroy is a hard sell.', 35], ['ishita', 'Drop. Resale at 30% is too much for the Court Purple.', 70]]],
  ['p10', [['zoya', 'Sales drop it to ₹8,999 sometimes on Ajio. Sizes 7–9 go first though.', 45], ['kabir', 'Hold for the sale if you have flexible sizing. If you are size 9 or above, buy now.', 90]]],
  ['p11', [['aarav', 'Raffle is per person not per size. Pickup is in store only as per last year\'s process. Bring ID.', 30], ['dev', 'Superkicks confirmed on their story that winners get an email at 8 PM.', 70]]],
  ['p12', [['meher', 'Campus 00s are the most comfortable slim sneakers I own. Cop it in black.', 25], ['nisha', 'Cop, but check the sole. Some batches have thinner outsoles.', 80]]],
  ['p13', [['aarav', 'Import duty and shipping add roughly 15–20%. Retail India is ₹15,999 but most stock is grey-market.', 60], ['kabir', 'Compare Culture Circle prices too. They sometimes undercut retailers on the 2002R.', 120]]],
  ['p14', [['rohan', 'Box label font does look slightly thin compared to my pair, but it might be lighting. Check the UPC and the style code text.', 45], ['aarav', 'Netting shape looks correct. I would ask for a photo of the insole and the heel tab.', 90]]],
  ['p15', [['meher', 'Vomero 5 has had a scheduled drop on the calendar. Check the drops page, it says two weeks from now.', 40], ['dev', 'Hold off on resale then, they are running about a 12% premium.', 100]]],
  ['p16', [['zoya', 'Wore mine in Delhi in June. Feet did feel warm but the grip and comfort are top notch.', 50], ['rohan', 'Buy the black. Lighter colourways get dirty fast if you commute daily.', 120]]],
  ['p17', [['meher', 'Yeezy Slide resale is flat right now. No pressure, but sizes 9–11 are the ones that will move.', 55], ['aarav', 'Wait a couple of weeks. Stockx-style resale settles about 10% down after the drop hype cools.', 140]]],
  ['p18', [['meher', 'Chuck 70 for style, Old Skool if you want to skate. Both are solid first sneakers.', 60], ['aarav', 'Chuck 70 has better cushioning than Old Skool. Get that if you walk a lot.', 130]]],
  ['p19', [['rohan', 'The rumour mill says global only, but Nike India has surprised us before. Keep an eye on the calendar.', 90], ['meher', 'If India has no allocation, wait for a restock. Resale premiums for the Big Bubble tend to fade after two months.', 180]]],
  ['p20', [['ishita', 'That price is the lowest I have seen this quarter. Grab it.', 40], ['aarav', 'Chuck 70 is regularly at ₹6,499 on Ajio. Not a rare deal, but it is decent.', 100]]],
];
for (const [pk, list] of COMMENT_ROWS) {
  const pid = uuid(`post:${pk}`);
  const postAge = POST_ROWS.find((r) => r[0] === pk)[7];
  commentsByPost.set(pid, list.map(([a, text, after], i) => ({
    id: uuid(`comment:${pk}:${i}`), postId: pid, authorUserId: U(a), body: text, createdAt: iso(BOOT - postAge * MIN + after * MIN),
  })));
}

function voteScoreOf(type, id) {
  const m = viewerVotes.get(`${type}:${id}`);
  let extra = 0;
  if (m) for (const v of m.values()) extra += v;
  return (baseVotes.get(`${type}:${id}`) ?? 0) + extra;
}
function pollOf(p, viewer) {
  if (!p.poll) return null;
  const m = pollVotes.get(p.id);
  let cop = p.poll.cop, drop = p.poll.drop;
  if (m) for (const c of m.values()) c === 'cop' ? cop++ : drop++;
  return { cop, drop, total: cop + drop, viewerChoice: (viewer && m?.get(viewer)) || null };
}
function postOut(p, viewer) {
  const u = userOf(p.authorUserId);
  const dr = p.dropKey ? dropRows().find((d) => d.key === p.dropKey) : null;
  let mi = null;
  if (p.intelCode) mi = catalogVariant(p.intelCode[0], p.intelCode[1])?.marketIntelligence ?? null;
  return {
    id: p.id, postType: p.postType, title: p.title, body: p.body, authorUserId: p.authorUserId,
    authorDisplayName: u?.displayName ?? null, authorAvatarSeed: u?.avatarSeed ?? p.authorUserId.slice(0, 8), authorReputationScore: scoreOf(u),
    createdAt: p.createdAt, commentCount: (commentsByPost.get(p.id) ?? []).length, voteScore: voteScoreOf('post', p.id),
    viewerVote: (viewer && viewerVotes.get(`post:${p.id}`)?.get(viewer)) || null,
    sneaker: p.sneaker, variant: p.variant, marketIntelligence: p.postType === 'price_check' ? mi : null,
    pollResults: p.postType === 'cop_or_drop' ? pollOf(p, viewer) : null,
    legitCheckChecklist: p.legitCheckChecklist, images: p.images,
    dropEvent: dr ? { id: dr.id, releaseDate: dr.releaseDate, status: dr.status } : null,
  };
}
function commentOut(c) {
  const u = userOf(c.authorUserId);
  return { id: c.id, postId: c.postId, authorUserId: c.authorUserId, authorDisplayName: u?.displayName ?? null, authorAvatarSeed: u?.avatarSeed ?? '', authorReputationScore: scoreOf(u), body: c.body, createdAt: c.createdAt };
}
const sortedPosts = () => [...posts.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

// community notifications (for the viewing user)
const notifState = new Map(); // viewerId -> { readAll, enabled }
function notificationsFor(viewer) {
  const st = notifState.get(viewer) ?? { read: false, enabled: true };
  const base = [
    ['reply', 'aarav', 'p1', 'comment', 'Third restock and everybody still owns a pair — that is the case for cop...', 30],
    ['mention', 'meher', 'p3', 'comment', '@you the tongue tag stitching on my retail pair is tight too, compare the spacing...', 75],
    ['reply', 'rohan', 'p8', 'comment', 'Rule of thumb: too good to be true usually is. Perforation looks uneven...', 240],
    ['reply', 'zoya', 'p12', 'comment', 'Campus 00s black is my daily. Slim cut works with everything...', 600],
    ['mention', 'dev', 'p16', 'post', '@you what do you think about summer wear on the XT-6?', 1440],
    ['reply', 'kabir', 'p9', 'comment', 'Drop. Resale at 30% is too much for the Court Purple...', 2880],
  ];
  return base.map(([type, actor, pk, entityType, preview, ageMin], i) => ({
    id: uuid(`notif:${i}`), type, actorUserId: U(actor), actorDisplayName: userOf(U(actor)).displayName, entityType, postId: uuid(`post:${pk}`), preview,
    createdAt: iso(Date.now() - ageMin * MIN), readAt: st.read || i > 2 ? iso(Date.now() - (ageMin - 5) * MIN) : null,
  }));
}

// ------------------------------------------------------------------ chat
const CHAT_LINES = {
  live: ['is it live for anyone?', 'SNKRS is throwing errors for me', 'Got in the queue, position 8000', 'Cart timer is 10 min, be quick', 'Just took an L, sold out on my size', 'Sizes 7 and 8 are still showing for me', 'Myntra page stuck at payment', 'Anyone in Bangalore know if Superkicks got stock?'],
  upcoming: ['Countdown set, will be ready', 'Do we know the exact time yet?', 'Anyone doing the raffle too?', 'Fingers crossed for a size 9 pair', 'Saving the card details in advance this time', 'I heard the allocation is bigger than the last drop'],
  archived: ['That was rough, sold out in minutes', 'Anyone selling a size 8?', 'Culture Circle listing already up', 'Congrats to everyone who copped', 'Waiting for a restock', 'Good run today, see you next drop'],
};
function chatRoomFor(d) {
  const relOpen = d.releaseMs - 24 * HOUR;
  return { id: uuid(`room:${d.key}`), dropEventId: d.id, status: d.status === 'upcoming' ? (relOpen > Date.now() ? 'scheduled' : 'open') : d.status === 'live' ? 'open' : 'archived', opensAt: iso(relOpen), archivesAt: d.status === 'sold_out' ? iso(d.releaseMs + 24 * HOUR) : null };
}
const chatExtra = new Map(); // roomId -> messages
function chatMessages(roomId) {
  const d = dropRows().find((r) => uuid(`room:${r.key}`) === roomId);
  if (!d) return null;
  const set = CHAT_LINES[d.status === 'live' ? 'live' : d.status === 'upcoming' ? 'upcoming' : 'archived'];
  const keys = ['aarav', 'meher', 'rohan', 'zoya', 'kabir', 'ishita', 'dev', 'tanvi'];
  const base = set.map((body, i) => {
    const u = userOf(U(keys[i % keys.length]));
    return { id: uuid(`msg:${roomId}:${i}`), roomId, authorUserId: u.id, authorDisplayName: u.displayName, authorAvatarSeed: u.avatarSeed, authorReputationScore: scoreOf(u), body, classifierStatus: 'approved', createdAt: iso(Date.now() - (set.length - i) * 4 * MIN) };
  });
  return [...base, ...(chatExtra.get(roomId) ?? [])];
}

// ------------------------------------------------------------------ misc state
const waitlist = new Set();
const feedbackRows = [];
const subscribers = new Map(); // id -> Map(key -> sub)
const reports = [
  ['post', 'p8', 'scam', 'Listing looks like a fake pair being pushed via DM.', 'pending', 'tanvi', 'p8'],
  ['comment', 'p3', 'harassment', 'Aggressive tone towards a new member.', 'pending', 'ishita', 'p3'],
  ['post', 'p13', 'spam', 'Looks like a repeated resale ad.', 'reviewed', 'aarav', 'p13'],
  ['user', 'yash', 'other', 'Posts links to an external group repeatedly.', 'actioned', 'meher', null],
  ['comment', 'p9', 'hate_speech', 'Aggressive slur used in the comments thread.', 'dismissed', 'zoya', 'p9'],
  ['message', 'aj1-chicago', 'doxxing', 'A user shared what looks like a personal phone number in chat.', 'pending', 'kabir', null],
].map(([entityType, ref, reason, details, status, reporter, postKey], i) => ({
  id: uuid(`report:${i}`), reporterUserId: U(reporter), reportedEntityType: entityType,
  reportedEntityId: entityType === 'user' ? U(ref) : entityType === 'message' ? uuid(`msg:${ref}`) : uuid(`post:${ref}`),
  reason, details, status, createdAt: iso(BOOT - (i + 1) * 5 * HOUR),
  reviewedBy: status === 'pending' ? null : U('aarav'), reviewedAt: status === 'pending' ? null : iso(BOOT - i * 2 * HOUR), reviewNote: status === 'pending' ? null : 'Reviewed and handled by the community team.',
  contentPreview: postKey ? (posts.get(uuid(`post:${postKey}`))?.body ?? '').slice(0, 120) : null,
  contentAuthorUserId: postKey ? posts.get(uuid(`post:${postKey}`))?.authorUserId ?? null : null,
  isHidden: postKey ? status === 'actioned' : null,
}));

// ------------------------------------------------------------------ http plumbing
function viewerOf(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const id = String(payload.userId ?? payload.sub ?? payload.id ?? 'viewer-me');
    ensureUser(id, payload.name ?? payload.displayName ?? payload.email?.split('@')[0]);
    return id;
  } catch {
    ensureUser('viewer-me', 'you');
    return 'viewer-me';
  }
}
function send(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Internal-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  });
  res.end(data);
}
const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString();
    if (!(req.headers['content-type'] || '').includes('json')) return resolve({});
    try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
  });
});
const int = (v, d, lo, hi) => { const n = parseInt(v ?? '', 10); return Number.isFinite(n) ? clamp(n, lo, hi) : d; };
const notFound = (msg = 'Not found') => [404, { error: 'not_found', message: msg }];
const unauth = () => [401, { statusCode: 401, message: 'Unauthorized' }];

async function route(req, url, seg, q) {
  const m = req.method;
  const [a, b, c, d] = seg;

  if (a === 'health' || (!a && m === 'GET')) return [200, { status: 'ok', mock: true, time: iso(Date.now()) }];

  // --- catalog
  if (a === 'catalog' && m === 'GET') {
    if (b === 'search') return [200, searchCatalog(q.get('q'), q.get('brand'), q.get('signal'), int(q.get('limit'), 24, 1, 100), int(q.get('offset'), 0, 0, 1e6))];
    if (b === 'variants') return [200, SNEAKERS.flatMap((s) => SIZES.map((size) => ({ styleCode: s.styleCode, size })))];
    if (b && c) { const r = catalogVariant(decodeURIComponent(b), c); return r ? [200, r] : notFound('No such sneaker or size.'); }
  }

  // --- drops
  if (a === 'drops' && m === 'GET') {
    if (b === 'by-style-code') {
      const rows = dropRows().filter((r) => r.code === decodeURIComponent(c ?? ''));
      const order = { live: 0, upcoming: 1, sold_out: 2 };
      rows.sort((x, y) => order[x.status] - order[y.status] || y.releaseDate.localeCompare(x.releaseDate));
      const r = rows[0];
      return [200, r ? { id: r.id, status: r.status, releaseDate: r.releaseDate, releaseTime: r.releaseTime, releaseTimezone: r.releaseTimezone, regions: r.regions, retailPrice: r.retailPrice, currency: r.currency, purchaseLinks: r.purchaseLinks, raffleInfo: r.raffleInfo } : null];
    }
    if (b) {
      const r = findDrop(decodeURIComponent(b));
      if (!r) return notFound('No drop with that id.');
      const s = BY_CODE.get(r.code);
      return [200, {
        ...dropListItem(r), purchaseLinks: r.purchaseLinks, raffleInfo: r.raffleInfo,
        defaultVariant: { id: variantId(s.styleCode, 9), size: 9, sizeSystem: SIZE_SYSTEM },
        relatedNews: news.filter((n) => n.dropEventId === r.id).map((n) => ({ id: n.id, title: n.title, publishedAt: iso(BOOT - n.ageMin * MIN), isBreaking: n.isBreaking })),
      }];
    }
    const from = q.get('from'), to = q.get('to'), st = q.get('status')?.split(',').filter(Boolean);
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) return [400, { statusCode: 400, message: ['from/to must be YYYY-MM-DD'] }];
    const list = dropRows().filter((r) => (!from || r.releaseDate >= from) && (!to || r.releaseDate <= to) && (!st?.length || st.includes(r.status)))
      .sort((x, y) => x.releaseDate.localeCompare(y.releaseDate) || (x.releaseTime ?? '99').localeCompare(y.releaseTime ?? '99'));
    return [200, list.map(dropListItem)];
  }

  // --- news
  if (a === 'news' && m === 'GET') {
    if (b) { const n = news.find((x) => x.id === b); return n ? [200, newsOut(n)] : notFound('No article with that id.'); }
    const filtered = news.filter((n) => !q.get('dropEventId') || n.dropEventId === q.get('dropEventId')).sort((x, y) => x.ageMin - y.ageMin);
    const limit = int(q.get('limit'), 20, 1, 50), offset = int(q.get('offset'), 0, 0, 1e6);
    return [200, { items: filtered.slice(offset, offset + limit).map(newsOut), total: filtered.length }];
  }

  // --- community
  if (a === 'community') {
    const viewer = viewerOf(req);
    if (b === 'posts') {
      if (!c && m === 'GET') {
        let list = sortedPosts();
        if (q.get('postType')) list = list.filter((p) => p.postType === q.get('postType'));
        if (q.get('dropEventId')) list = list.filter((p) => { const dr = p.dropKey && uuid(`drop:${p.dropKey}`); return dr === q.get('dropEventId'); });
        if (q.get('authorUserId')) list = list.filter((p) => p.authorUserId === q.get('authorUserId'));
        const limit = int(q.get('limit'), 20, 1, 50), offset = int(q.get('offset'), 0, 0, 1e6);
        return [200, { posts: list.slice(offset, offset + limit).map((p) => postOut(p, viewer)), total: list.length }];
      }
      if (!c && m === 'POST') {
        if (!viewer) return unauth();
        const body = await readBody(req);
        if (!['price_check', 'cop_or_drop', 'legit_check', 'drop_talk'].includes(body.postType)) return [400, { statusCode: 400, message: ['postType must be one of the following values'] }];
        if (!body.title && !body.body) return [400, { statusCode: 400, message: ['title or body must be provided'] }];
        const vr = body.sneakerVariantId ? VARIANT_INDEX.get(body.sneakerVariantId) : null;
        const s = vr?.sneaker;
        const id = uuid(`post:new:${Date.now()}:${Math.random()}`);
        const dropRow = body.dropEventId ? dropRows().find((x) => x.id === body.dropEventId) : null;
        posts.set(id, {
          id, postType: body.postType, title: body.title ?? null, body: body.body ?? null, authorUserId: viewer, createdAt: iso(Date.now()),
          sneaker: s ? { styleCode: s.styleCode, brand: s.brand, model: s.model, colorway: s.colorway } : null,
          variant: vr ? { id: body.sneakerVariantId, size: String(vr.size), sizeSystem: SIZE_SYSTEM } : null,
          intelCode: vr ? [s.styleCode, vr.size] : null,
          poll: body.postType === 'cop_or_drop' ? { cop: 0, drop: 0 } : null,
          legitCheckChecklist: Array.isArray(body.legitCheckChecklist) ? body.legitCheckChecklist : null, images: body.postType === 'legit_check' ? [] : null,
          dropKey: dropRow?.key ?? null,
        });
        baseVotes.set(`post:${id}`, 0);
        return [201, { post: postOut(posts.get(id), viewer) }];
      }
      const p = posts.get(c);
      if (!p) return notFound('No post with that id.');
      if (!d && m === 'GET') return [200, { post: postOut(p, viewer) }];
      if (d === 'comments' && m === 'GET') return [200, { comments: (commentsByPost.get(p.id) ?? []).map(commentOut) }];
      if (d === 'comments' && m === 'POST') {
        if (!viewer) return unauth();
        const body = await readBody(req);
        if (!body.body || typeof body.body !== 'string' || body.body.length > 2000) return [400, { statusCode: 400, message: ['body must be between 1 and 2000 characters'] }];
        const cm = { id: uuid(`comment:new:${Date.now()}:${Math.random()}`), postId: p.id, authorUserId: viewer, body: body.body, createdAt: iso(Date.now()) };
        commentsByPost.set(p.id, [...(commentsByPost.get(p.id) ?? []), cm]);
        return [201, { comment: commentOut(cm) }];
      }
      if (d === 'poll-vote' && m === 'POST') {
        if (!viewer) return unauth();
        const body = await readBody(req);
        if (!p.poll) return [400, { statusCode: 400, message: 'Not a poll post.' }];
        if (!['cop', 'drop'].includes(body.choice)) return [400, { statusCode: 400, message: ['choice must be cop or drop'] }];
        if (!pollVotes.has(p.id)) pollVotes.set(p.id, new Map());
        pollVotes.get(p.id).set(viewer, body.choice);
        const r = pollOf(p, viewer);
        return [200, { cop: r.cop, drop: r.drop }];
      }
      if (d === 'images' && m === 'POST') {
        if (!viewer) return unauth();
        const img = { id: uuid(`img:new:${Date.now()}`), url: svg('uploaded photo', 200), checklistItemId: null, classifierStatus: 'approved' };
        p.images = [...(p.images ?? []), img];
        return [201, { image: img }];
      }
    }
    if (b === 'vote' && m === 'POST') {
      if (!viewer) return unauth();
      const body = await readBody(req);
      if (!['post', 'comment'].includes(body.votableType) || !body.votableId) return [400, { statusCode: 400, message: ['invalid vote'] }];
      const k = `${body.votableType}:${body.votableId}`;
      if (!viewerVotes.has(k)) viewerVotes.set(k, new Map());
      if (body.value === 0) viewerVotes.get(k).delete(viewer); else viewerVotes.get(k).set(viewer, body.value === -1 ? -1 : 1);
      return [200, { voteScore: voteScoreOf(body.votableType, body.votableId) }];
    }
    if (b === 'activity' && c && m === 'GET') {
      const userPosts = sortedPosts().filter((p) => p.authorUserId === c).map((p) => postOut(p, viewer));
      const userComments = [...commentsByPost.values()].flat().filter((cm) => cm.authorUserId === c).map((cm) => ({ ...commentOut(cm), postTitle: posts.get(cm.postId)?.title ?? null }));
      return [200, { posts: userPosts, comments: userComments }];
    }
    if (b === 'notifications') {
      if (!viewer) return unauth();
      const st = notifState.get(viewer) ?? { read: false, enabled: true };
      notifState.set(viewer, st);
      if (!c && m === 'GET') return [200, { notifications: notificationsFor(viewer) }];
      if (c === 'unread-count') return [200, { count: notificationsFor(viewer).filter((n) => !n.readAt).length }];
      if (c === 'mark-read' && m === 'POST') { st.read = true; return [200, { ok: true }]; }
      if (c === 'preference' && m === 'GET') return [200, { enabled: st.enabled }];
      if (c === 'preference' && m === 'PATCH') { const body = await readBody(req); st.enabled = body.enabled !== false; return [200, { ok: true }]; }
    }
  }

  // --- reputation
  if (a === 'reputation' && b && m === 'GET') { const r = reputationOf(decodeURIComponent(b)); return r ? [200, r] : notFound('No user with that id.'); }

  // --- chat
  if (a === 'chat' && b === 'rooms') {
    if (c === 'by-drop' && d && m === 'GET') { const dr = findDrop(d); return [200, { room: dr ? chatRoomFor(dr) : null }]; }
    if (c && d === 'messages' && m === 'GET') { const ms = chatMessages(c); return ms ? [200, { messages: ms }] : [200, { messages: [] }]; }
  }

  // --- notifications (drop alerts)
  if (a === 'notifications') {
    if (b === 'identify' && m === 'POST') { const id = uuid(`subscriber:${Date.now()}:${Math.random()}`); subscribers.set(id, new Map()); return [201, { subscriberId: id }]; }
    if (b === 'vapid-public-key' && m === 'GET') return [200, { publicKey: null }];
    if (b === 'push-subscribe' && m === 'POST') return [201, { ok: true }];
    if (b === 'subscriptions') {
      if (m === 'GET') {
        const id = q.get('subscriberId');
        if (!id) return [400, { statusCode: 400, message: ['subscriberId should not be empty'] }];
        return [200, { subscriptions: [...(subscribers.get(id) ?? new Map()).values()] }];
      }
      const body = await readBody(req);
      if (!body.subscriberId || !['brand', 'model', 'global'].includes(body.scopeType)) return [400, { statusCode: 400, message: ['invalid subscription'] }];
      if (!subscribers.has(body.subscriberId)) subscribers.set(body.subscriberId, new Map()); // stale ids are auto-adopted in the mock
      const key = `${body.scopeType}:${body.scopeValue ?? ''}`;
      if (m === 'POST') {
        const label = body.scopeType === 'global' ? 'Every drop' : body.scopeType === 'brand' ? `All ${body.scopeValue} drops` : String(body.scopeValue);
        subscribers.get(body.subscriberId).set(key, { id: uuid(`sub:${body.subscriberId}:${key}`), scopeType: body.scopeType, scopeValue: body.scopeValue ?? null, label, createdAt: iso(Date.now()) });
        return [201, { ok: true }];
      }
      if (m === 'DELETE') { subscribers.get(body.subscriberId).delete(key); return [200, { ok: true }]; }
    }
  }

  // --- waitlist / feedback
  if (a === 'waitlist' && m === 'POST') {
    const body = await readBody(req);
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return [400, { statusCode: 400, message: ['email must be an email'] }];
    if (waitlist.has(email)) return [409, { error: 'duplicate', message: "You're already on the list — we'll email you when access opens." }];
    waitlist.add(email);
    return [201, { ok: true }];
  }
  if (a === 'feedback') {
    if (m === 'POST') {
      const body = await readBody(req);
      if (!body.message || !String(body.message).trim()) return [400, { statusCode: 400, message: ['message should not be empty'] }];
      feedbackRows.unshift({ id: uuid(`fb:${Date.now()}`), topic: body.topic ?? 'other', message: body.message, contact_email: body.contactEmail ?? null, source_path: body.sourcePath ?? null, created_at: iso(Date.now()) });
      return [201, { ok: true }];
    }
    if (m === 'GET') return [200, { feedback: feedbackRows }];
  }

  // --- trust & safety / admin
  if (a === 'trust-safety' && b === 'reports') {
    const viewer = viewerOf(req);
    if (!viewer) return unauth();
    if (!c && m === 'POST') {
      const body = await readBody(req);
      if (!body.reportedEntityType || !body.reportedEntityId || !body.reason) return [400, { statusCode: 400, message: ['invalid report'] }];
      const rep = { id: uuid(`report:new:${Date.now()}`), reporterUserId: viewer, reportedEntityType: body.reportedEntityType, reportedEntityId: body.reportedEntityId, reason: body.reason, details: body.details ?? null, status: 'pending', createdAt: iso(Date.now()), reviewedBy: null, reviewedAt: null, reviewNote: null, contentPreview: null, contentAuthorUserId: null, isHidden: null };
      reports.unshift(rep);
      return [201, { report: rep }];
    }
    if (!c && m === 'GET') { const st = q.get('status'); const list = reports.filter((r) => !st || r.status === st); return [200, { reports: list, total: list.length }]; }
    if (c && m === 'PATCH') {
      const rep = reports.find((r) => r.id === c);
      if (!rep) return notFound('No report with that id.');
      const body = await readBody(req);
      Object.assign(rep, { status: body.status ?? rep.status, reviewNote: body.note ?? null, reviewedBy: viewer, reviewedAt: iso(Date.now()) });
      return [200, { report: rep }];
    }
  }
  if (a === 'trust-safety' && b === 'blocks') return m === 'GET' ? [200, { blocks: [] }] : [201, { ok: true }];
  if (a === 'admin' && b === 'community-health' && m === 'GET') {
    const types = ['price_check', 'cop_or_drop', 'legit_check', 'drop_talk'];
    const postsPerDay = [];
    for (let i = 6; i >= 0; i--) for (const t of types) postsPerDay.push({ day: istDateOffset(-i), postType: t, count: Math.floor(rngFor(`h:${i}:${t}`)() * 9) + 1 });
    const byStatus = { pending: 3, reviewed: 1, actioned: 1, dismissed: 1 };
    return [200, {
      postsPerDay, activeUsers7d: 214, reports: { last7d: 6, last30d: 19, byStatus, resolutionRatePct: 50 },
      highReportRooms: DROP_ROWS.slice(0, 2).map((r, i) => ({ roomId: uuid(`room:${r[0]}`), dropEventId: uuid(`drop:${r[0]}`), sneakerLabel: `${BY_CODE.get(r[1]).brand} ${BY_CODE.get(r[1]).model}`, reportCount: 4 - i })),
    }];
  }

  // --- internal (auth support)
  if (a === 'internal' && m === 'POST') {
    if (b === 'auth-rate-limit') return [200, { allowed: true }];
    if (b === 'session-revocation') return c === 'check' ? [200, { revoked: false }] : [200, { ok: true }];
  }

  return notFound(`Cannot ${m} ${url.pathname}`);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Internal-Secret', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Max-Age': '86400' }); return res.end(); }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const seg = url.pathname.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  try {
    const [status, body] = await route(req, url, seg, url.searchParams);
    console.log(`${req.method} ${req.url} -> ${status}`);
    send(res, status, body);
  } catch (err) {
    console.error(err);
    send(res, 500, { statusCode: 500, message: String(err?.message ?? err) });
  }
});
server.listen(PORT, () => console.log(`CHOSN mock API listening on http://localhost:${PORT}`));

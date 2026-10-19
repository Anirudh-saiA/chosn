/**
 * Buy clicks remembered on the shopper's own device (localStorage only, never sent anywhere) so CHOSN can ask a few days later
 * "Did it arrive? Was it as described?". Nothing is stored on the server until the shopper submits the form.
 */
const KEY = 'chosn_pending_feedback';

export interface PendingPurchase {
  styleCode: string;
  size?: number;
  store: string;
  storeName: string;
  shoeName: string;
  promisedMaxDays: number | null;
  clickedAt: number;
}

function read(): PendingPurchase[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: PendingPurchase[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-10)));
  } catch {
    /* ignore */
  }
}

export function rememberPurchase(p: Omit<PendingPurchase, 'clickedAt'>): void {
  if (typeof window === 'undefined') return;
  const list = read().filter((x) => !(x.styleCode === p.styleCode && x.store === p.store));
  write([...list, { ...p, clickedAt: Date.now() }]);
}

export function forgetPurchase(styleCode: string, store: string): void {
  if (typeof window === 'undefined') return;
  write(read().filter((x) => !(x.styleCode === styleCode && x.store === store)));
}

/** The oldest click that is at least `minDays` old (default 3), or null. */
export function duePurchase(minDays = 3): PendingPurchase | null {
  if (typeof window === 'undefined') return null;
  const cutoff = Date.now() - minDays * 86_400_000;
  const stale = Date.now() - 45 * 86_400_000;
  const list = read().filter((x) => x.clickedAt > stale);
  return list.find((x) => x.clickedAt <= cutoff) ?? null;
}

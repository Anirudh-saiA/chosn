/**
 * Client for apps/api/src/drops/notifications — the Day 12 identity
 * model (a bare `subscriberId`, no login) applied on the frontend: the
 * id is minted once via `identify()` and persisted in localStorage, the
 * same low-friction shape as everything else this no-accounts product
 * asks a visitor for.
 */

export type SubscriptionScope = 'brand' | 'model' | 'global';

export interface SubscriptionListItem {
  id: string;
  scopeType: SubscriptionScope;
  scopeValue: string | null;
  label: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'chosn:subscriberId';

/**
 * localStorage can throw (private browsing, blocked site data) or come
 * back empty — every caller here already treats "no id yet" as a normal
 * state (identify() mints one), so a wrapped, swallowed failure is the
 * correct behavior, not a special case to plumb through.
 */
export function getStoredSubscriberId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSubscriberId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Non-fatal — the id still works for this request, it just won't
    // survive a reload. Nothing to recover from here.
  }
}

/**
 * Returns the persisted subscriberId, minting one via the API on first
 * use. Safe to call every time a "Notify me" action starts — it's a
 * no-op read after the first call in a browser that keeps localStorage.
 */
export async function ensureSubscriberId(): Promise<string> {
  const existing = getStoredSubscriberId();
  if (existing) return existing;

  const res = await fetch(`${API_URL}/notifications/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`identify failed: ${res.status}`);
  const { subscriberId } = (await res.json()) as { subscriberId: string };
  storeSubscriberId(subscriberId);
  return subscriberId;
}

/**
 * Re-identifies and retries once on a 404 unknown_subscriber (the
 * NotificationsService.assertSubscriberExists guard) — the one real way
 * a stored id goes stale: a wiped dev database, not something that
 * happens in production, but cheap to handle correctly either way.
 */
async function withFreshSubscriber<T>(fn: (subscriberId: string) => Promise<Response>): Promise<T> {
  let subscriberId = await ensureSubscriberId();
  let res = await fn(subscriberId);

  if (res.status === 404) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* see getStoredSubscriberId */
    }
    subscriberId = await ensureSubscriberId();
    res = await fn(subscriberId);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function subscribe(scopeType: SubscriptionScope, scopeValue: string | null): Promise<void> {
  await withFreshSubscriber((subscriberId) =>
    fetch(`${API_URL}/notifications/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriberId, scopeType, scopeValue: scopeValue ?? undefined }),
    }),
  );
}

export async function unsubscribe(scopeType: SubscriptionScope, scopeValue: string | null): Promise<void> {
  await withFreshSubscriber((subscriberId) =>
    fetch(`${API_URL}/notifications/subscriptions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriberId, scopeType, scopeValue: scopeValue ?? undefined }),
    }),
  );
}

export async function listSubscriptions(): Promise<SubscriptionListItem[]> {
  const subscriberId = getStoredSubscriberId();
  if (!subscriberId) return [];
  const res = await fetch(`${API_URL}/notifications/subscriptions?subscriberId=${encodeURIComponent(subscriberId)}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { subscriptions: SubscriptionListItem[] };
  return body.subscriptions;
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await fetch(`${API_URL}/notifications/vapid-public-key`);
  if (!res.ok) return null;
  const { publicKey } = (await res.json()) as { publicKey: string | null };
  return publicKey;
}

/** Standard base64url → Uint8Array conversion PushManager.subscribe() needs for applicationServerKey. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Explicit Uint8Array<ArrayBuffer>, not the plain `Uint8Array` TS
  // infers by default (= Uint8Array<ArrayBufferLike>) — DOM's
  // BufferSource/ArrayBufferView<ArrayBuffer> type that
  // applicationServerKey expects doesn't accept the wider
  // ArrayBufferLike (which also covers SharedArrayBuffer), and only
  // the explicit generic gets TS to check the two backing-buffer types
  // as compatible, even though a plain-array-length `new Uint8Array(n)`
  // is always real-ArrayBuffer-backed at runtime either way.
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushPermissionResult = 'subscribed' | 'denied' | 'unsupported' | 'error';

/**
 * The contextual permission flow (task 3): call this right after a
 * successful subscribe(), never on page load — Notification.requestPermission()
 * triggered unprompted is a well-known trust-destroying pattern this
 * deliberately avoids (see NotifyToggle's own comment for where this is
 * actually called from).
 */
export async function requestPushPermission(): Promise<PushPermissionResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) return 'error'; // API running without VAPID keys configured — see .env.example

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const pushSubscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const subscriberId = await ensureSubscriberId();
    const json = pushSubscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const res = await fetch(`${API_URL}/notifications/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriberId, endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) return 'error';

    return 'subscribed';
  } catch {
    return 'error';
  }
}

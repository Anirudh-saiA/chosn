import { getConsent } from './consent';

/**
 * Anonymous shopper signals for the comparison page: a "view" of a shoe and a "click" on a store's Buy button. They are sent to our own
 * API (apps/api events.controller.ts) and become "chosen by N shoppers for this shoe". Nothing personal is sent. A random visitor token is
 * added only if the visitor has agreed to analytics, and only so repeat visits can be counted.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const VISITOR_KEY = 'chosn_visitor';

export interface TrackEvent {
  event: 'view' | 'click';
  styleCode: string;
  size?: number;
  store?: string;
  price?: number;
  position?: number;
  sort?: 'value' | 'price' | 'fastest';
}

function visitorId(): string | undefined {
  try {
    if (getConsent() !== 'granted') return undefined;
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** Fire and forget: tracking must never slow or break a page, or stop a Buy link from opening. */
export function track(e: TrackEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({ ...e, visitorId: visitorId() });
    // keepalive lets the request finish even as the page is left (a Buy link opens a new tab). Not sendBeacon: it always sends cookies,
    // which this API's CORS rules do not allow, so the browser would drop it silently.
    void fetch(`${API_URL}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface DropLiveMessage {
  type: 'drop:live';
  dropEventId: string;
  sneakerId: string;
  timestamp: string;
}

function isDropLiveMessage(value: unknown): value is DropLiveMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as DropLiveMessage).type === 'drop:live' &&
    typeof (value as DropLiveMessage).dropEventId === 'string'
  );
}

function wsUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return apiUrl.replace(/^http/, 'ws') + '/ws/drops';
}

const DropLiveContext = createContext<Set<string> | null>(null);

/**
 * One WebSocket connection per page, shared by every drop shown on it —
 * Day 14's `useDropLiveSocket` opens a connection per dropEventId, which
 * was fine for the price page (at most one drop ever rendered there) but
 * would mean 20-30 separate connections to the same gateway on a
 * calendar page listing a month of drops. This provider opens exactly
 * one, and every `DropStatusBadge`/`useIsDropLive` consumer under it
 * just reads from the same shared set.
 *
 * Opt-in, not global: only pages that actually render drop statuses wrap
 * themselves in this (the calendar and drop-detail pages today) — a page
 * with nothing live to show has no reason to hold a socket open.
 */
export function DropLiveProvider({ children }: { children: ReactNode }) {
  const [liveIds, setLiveIds] = useState<Set<string>>(() => new Set());
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (cancelled) return;
      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.addEventListener('message', (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isDropLiveMessage(parsed)) {
            setLiveIds((prev) => {
              if (prev.has(parsed.dropEventId)) return prev;
              const next = new Set(prev);
              next.add(parsed.dropEventId);
              return next;
            });
          }
        } catch {
          // Malformed frame — ignore rather than throw inside an event handler.
        }
      });

      socket.addEventListener('close', () => {
        if (!cancelled) retryTimer = setTimeout(connect, 3000);
      });
      socket.addEventListener('error', () => socket.close());
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  return <DropLiveContext.Provider value={liveIds}>{children}</DropLiveContext.Provider>;
}

/**
 * True the instant `dropEventId` flips live, without a refresh. Reads
 * the page-shared connection when rendered under `DropLiveProvider`
 * (the calendar and drop-detail pages); falls back to opening its own
 * single-purpose connection when it isn't (the sneaker price page,
 * which only ever shows one drop and predates this provider) — same
 * public contract either way, so nothing else has to know which mode
 * it's running in.
 */
export function useIsDropLive(dropEventId: string | null): boolean {
  const shared = useContext(DropLiveContext);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (shared !== null || !dropEventId) return; // provider present — no standalone connection needed

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;

    function connect() {
      if (cancelled) return;
      socket = new WebSocket(wsUrl());
      socket.addEventListener('message', (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isDropLiveMessage(parsed) && parsed.dropEventId === dropEventId) setStandalone(true);
        } catch {
          /* ignore malformed frame */
        }
      });
      socket.addEventListener('close', () => {
        if (!cancelled) retryTimer = setTimeout(connect, 3000);
      });
      socket.addEventListener('error', () => socket?.close());
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, [shared, dropEventId]);

  if (!dropEventId) return false;
  if (shared !== null) return shared.has(dropEventId);
  return standalone;
}

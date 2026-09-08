'use client';

import { useEffect, useRef, useState } from 'react';

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

/** http(s):// -> ws(s):// against the same API host — DropLiveGateway is mounted on the API, not a separate service. */
function wsUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return apiUrl.replace(/^http/, 'ws') + '/ws/drops';
}

/**
 * Global broadcast on the wire (DropLiveGateway's flagged v1 choice —
 * one room, no per-brand/per-model scoping), filtered client-side to
 * the one dropEventId this component cares about — matches the
 * gateway's own reasoning: cheap to broadcast everything, the cost
 * lands here as "ignore messages that aren't about me," not as a wrong
 * UI update.
 *
 * Reconnects with a short fixed backoff on close/error — no exponential
 * backoff library pulled in for this; a page with the drop's own status
 * badge open is exactly the case where staying connected matters, and a
 * flat 3s retry is simple enough to reason about for what's currently a
 * handful of concurrent viewers.
 */
export function useDropLiveSocket(dropEventId: string | null): { isLive: boolean } {
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!dropEventId) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (cancelled) return;
      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.addEventListener('message', (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isDropLiveMessage(parsed) && parsed.dropEventId === dropEventId) {
            setIsLive(true);
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
  }, [dropEventId]);

  return { isLive };
}

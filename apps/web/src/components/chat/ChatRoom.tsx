'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Lock, Send, Terminal } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { ReportButton } from '@/components/community/ReportButton';
import { ReputationBadge } from '@/components/community/ReputationBadge';
import { chatWsUrl, getChatHistory, type ChatMessage, type ChatRoom as ChatRoomSummary } from '@/lib/chat';

interface ChatRoomProps {
  room: ChatRoomSummary;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Task 6's chat UI — message list, input, and the rate-limit feedback
 * the brief specifically calls for during high-traffic drop moments.
 * `chat:error` frames from the gateway (rate-limited, not signed in, or
 * an archived room) render as an inline notice rather than a toast —
 * this widget is small and always in view, so the notice doesn't need
 * to interrupt anything else on the page.
 */
export function ChatRoom({ room }: ChatRoomProps) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const ownUserId = (session?.user as unknown as { id?: string } | undefined)?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // Task 7's accessibility pass: a visually-hidden live region announces
  // each *new* incoming message to a screen reader, separate from the
  // visible list — the list itself isn't aria-live, so loading 100
  // history rows on mount doesn't get announced as 100 live updates.
  const [announcement, setAnnouncement] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isArchived = room.status === 'archived';

  useEffect(() => {
    // Deliberately not re-running on every apiToken change (e.g. session
    // refresh) — refiltering history mid-scroll on a token rotation
    // would be a jarring message-count jump for no visible reason; a
    // fresh mount (room change, page reload) picks up the current token.
    getChatHistory(room.id, apiToken).then(setMessages);
  }, [room.id]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (cancelled) return;
      const socket = new WebSocket(chatWsUrl(apiToken));
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        setConnected(true);
        socket.send(JSON.stringify({ type: 'chat:join', roomId: room.id }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'chat:message' && parsed.roomId === room.id) {
            setMessages((prev) => [...prev, parsed.message]);
            const from = parsed.message.authorDisplayName ?? 'Collector';
            setAnnouncement(`${from}: ${parsed.message.body}`);
          } else if (parsed.type === 'chat:retract' && parsed.roomId === room.id) {
            setMessages((prev) => prev.filter((m) => m.id !== parsed.messageId));
          } else if (parsed.type === 'chat:error') {
            setNotice(parsed.message);
          }
        } catch {
          /* malformed frame — ignore */
        }
      });

      socket.addEventListener('close', () => {
        setConnected(false);
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
  }, [room.id, apiToken]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'chat:send', roomId: room.id, body: draft.trim() }));
    setDraft('');
    setNotice(null);
  }

  return (
    <section aria-label="Drop chat" className="panel ticks overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-text/[0.08] bg-vault-recessed px-4 py-3">
        <p className="flex items-center gap-2 font-mono text-ui-label font-semibold uppercase tracking-[0.12em] text-text">
          <Terminal className="h-4 w-4 text-brass" aria-hidden />
          # drop-chat
          {isArchived && <span className="text-text-soft normal-case tracking-normal">· archived, read-only</span>}
        </p>
        <span
          className={`inline-flex items-center gap-2 font-mono text-meta font-semibold ${connected ? 'text-signal' : 'text-text-soft'}`}
          role="status"
        >
          <span className={connected ? 'live-dot' : 'inline-block h-2 w-2 rounded-full bg-text-faint'} aria-hidden />
          {connected ? 'LIVE' : 'RECONNECTING'}
        </span>
      </div>

      {/* Visually hidden — see the `announcement` state's own comment. Not the visible list itself, which would re-announce the whole history on every mount. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      <div ref={listRef} className="flex h-80 flex-col gap-3 overflow-y-auto bg-vault-recessed/60 px-4 py-4">
        {messages.length === 0 && (
          <p className="font-mono text-meta text-text-soft">
            <span className="text-brass">$</span> no messages yet — be first.
          </p>
        )}
        {messages.map((m) => {
          const own = ownUserId != null && m.authorUserId === ownUserId;
          return (
            <div key={m.id} className={`group flex items-start gap-2.5 ${own ? 'flex-row-reverse' : ''}`}>
              {!own && (
                <Link href={`/u/${m.authorUserId}`} aria-label={`${m.authorDisplayName ?? 'Collector'}'s profile`} className="mt-0.5 shrink-0">
                  <AvatarIdenticon seed={m.authorAvatarSeed} size={28} ring />
                </Link>
              )}
              <div className={`min-w-0 max-w-[85%] ${own ? 'items-end text-right' : ''}`}>
                <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${own ? 'justify-end' : ''}`}>
                  <Link href={`/u/${m.authorUserId}`} className="font-mono text-meta font-semibold text-text hover:text-brass-bright">
                    {own ? 'You' : (m.authorDisplayName ?? 'Collector')}
                  </Link>
                  {!own && <ReputationBadge score={m.authorReputationScore} />}
                  <time dateTime={m.createdAt} suppressHydrationWarning className="font-mono text-[0.65rem] text-text-soft">
                    {clock(m.createdAt)}
                  </time>
                </div>
                <p
                  className={`mt-1 inline-block max-w-full whitespace-pre-wrap break-words border px-3 py-2 text-left text-body ${
                    own ? 'border-brass/40 bg-brass/[0.12] text-text' : 'border-text/10 bg-vault-raised text-text'
                  }`}
                >
                  {m.body}
                </p>
              </div>
              {!own && (
                // group-focus-within, not just group-hover — a keyboard user
                // tabbing to this button must be able to see it once
                // focused, not just a mouse user hovering.
                <span className="shrink-0 self-center opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <ReportButton entityType="message" entityId={m.id} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {notice && (
        <p role="alert" className="flex items-center gap-2 border-t border-rust/30 bg-rust/[0.08] px-4 py-2 font-mono text-meta text-rust">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {isArchived ? (
        <p className="flex items-center gap-2 border-t border-text/[0.08] px-4 py-3 font-mono text-meta text-text-soft">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          This chat has closed — history stays browsable above.
        </p>
      ) : apiToken ? (
        <form onSubmit={send} className="flex items-stretch gap-2 border-t border-text/[0.08] bg-vault-deep/60 p-3">
          <label htmlFor={`chat-${room.id}`} className="sr-only">
            Chat message
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2 border border-text/15 bg-vault-recessed px-3 transition-colors focus-within:border-ice focus-within:shadow-[0_0_0_3px_rgba(143,214,255,.18)]">
            <span aria-hidden className="font-mono text-brass">
              &gt;
            </span>
            <input
              id={`chat-${room.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Say something…"
              maxLength={500}
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 bg-transparent font-mono text-ui-label text-text outline-none placeholder:text-text-faint"
            />
            <span className="hidden font-mono text-[0.65rem] text-text-soft sm:inline">{draft.length}/500</span>
          </div>
          <button
            type="submit"
            disabled={!draft.trim() || !connected}
            aria-label="Send message"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-brass-bright/40 bg-brass-gradient px-4 font-sans text-ui-label font-semibold text-vault-deep transition-all hover:shadow-glow-brass disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
          >
            <Send className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-text/[0.08] px-4 py-3">
          <p className="font-mono text-meta text-text-soft">Sign in to join the chat.</p>
          <Link href="/login" className="font-mono text-meta font-semibold text-brass-bright underline underline-offset-4">
            Sign in
          </Link>
        </div>
      )}
    </section>
  );
}

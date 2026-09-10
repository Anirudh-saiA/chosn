'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { chatWsUrl, getChatHistory, type ChatMessage, type ChatRoom as ChatRoomSummary } from '@/lib/chat';

interface ChatRoomProps {
  room: ChatRoomSummary;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isArchived = room.status === 'archived';

  useEffect(() => {
    getChatHistory(room.id).then(setMessages);
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
    <div className="border border-moss/20 bg-vault-raised">
      <div className="flex items-center justify-between border-b border-moss/20 px-4 py-2.5">
        <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">
          Drop chat {isArchived && '— archived (read-only)'}
        </p>
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-signal' : 'bg-text-faint'}`} aria-label={connected ? 'Connected' : 'Reconnecting'} />
      </div>

      <div ref={listRef} className="flex h-64 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="font-mono text-meta text-text-faint">No messages yet — be first.</p>}
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <AvatarIdenticon seed={m.authorAvatarSeed} size={20} className="mt-0.5 shrink-0" />
            <p className="text-body text-text">
              <span className="font-mono text-meta text-text-faint">{m.authorDisplayName ?? 'Collector'}: </span>
              {m.body}
            </p>
          </div>
        ))}
      </div>

      {notice && <p className="border-t border-moss/15 px-4 py-2 font-mono text-meta text-rust">{notice}</p>}

      {isArchived ? (
        <p className="border-t border-moss/15 px-4 py-2.5 font-mono text-meta text-text-faint">
          This chat has closed — history stays browsable above.
        </p>
      ) : apiToken ? (
        <form onSubmit={send} className="flex gap-2 border-t border-moss/15 p-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something…"
            maxLength={500}
            className="flex-1 border border-moss/30 bg-vault px-3 py-1.5 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="border border-brass bg-brass px-4 py-1.5 font-mono text-ui-label font-semibold text-vault disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="border-t border-moss/15 px-4 py-2.5 font-mono text-meta text-text-faint">Sign in to chat.</p>
      )}
    </div>
  );
}

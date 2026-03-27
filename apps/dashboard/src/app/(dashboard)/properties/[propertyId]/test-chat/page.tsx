'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface DbMessage {
  id: string;
  role: 'GUEST' | 'AI' | 'STAFF' | 'SYSTEM';
  content: string;
  createdAt: string;
}

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const HEADERS = {
  Authorization: 'Bearer dev-token',
  'x-organization-id': 'dev-org',
  'Content-Type': 'application/json',
};

export default function TestChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const propertyId = params['propertyId'] as string;

  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [input, setInput] = useState('');
  const [guestName, setGuestName] = useState('Test Guest');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    searchParams.get('conversationId'),
  );
  const [escalated, setEscalated] = useState(false);
  const [escalationReason, setEscalationReason] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(
        `${API}/api/properties/${propertyId}/conversations/${convId}`,
        { headers: HEADERS },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { conversation: { messages: DbMessage[] } };
      setMessages(data.conversation.messages);
    } catch {
      // silently ignore
    }
  }, [propertyId]);

  // Load conversation from URL param or when conversationId changes
  useEffect(() => {
    if (!conversationId) return;
    void fetchMessages(conversationId);

    // Poll every 3 seconds for new messages (e.g. host replies)
    pollingRef.current = setInterval(() => void fetchMessages(conversationId), 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [conversationId, fetchMessages]);

  function clearChat() {
    setMessages([]);
    setConversationId(null);
    setEscalated(false);
    setEscalationReason(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/properties/${propertyId}/test-chat`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          guestMessage: msg,
          guestName,
          conversationId: conversationId ?? undefined,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        conversationId?: string;
        escalated?: boolean;
        escalationReason?: string;
      };

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
      } else if (conversationId) {
        // Refresh messages immediately after sending
        await fetchMessages(conversationId);
      }

      if (data.escalated) {
        setEscalated(true);
        setEscalationReason(data.escalationReason ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', maxWidth: '680px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>🧪 Test Chat</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Simulate a guest conversation to test your Personal House Companion.
        </p>
      </div>

      {/* Guest name + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Guest name:</label>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '13px',
            color: 'var(--color-text)',
            outline: 'none',
            width: '160px',
          }}
        />
        {conversationId && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
            conv: {conversationId.slice(-8)}
          </span>
        )}
        <button
          onClick={clearChat}
          style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}
        >
          New chat
        </button>
      </div>

      {/* Escalation banner */}
      {escalated && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '12px',
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          color: 'var(--color-error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <span>⚠ Escalated{escalationReason ? `: ${escalationReason}` : ''}</span>
          <Link
            href={`/properties/${propertyId}/escalations` as never}
            style={{ color: 'var(--color-error)', fontWeight: '600', textDecoration: 'underline', flexShrink: 0 }}
          >
            View escalations
          </Link>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
            Send a message to start the conversation
          </div>
        )}

        {messages.map((m) => {
          const isGuest = m.role === 'GUEST';
          const isStaff = m.role === 'STAFF';
          const isSystem = m.role === 'SYSTEM';
          if (isSystem) return null;

          return (
            <div key={m.id}>
              <div style={{ display: 'flex', justifyContent: isGuest ? 'flex-end' : 'flex-start' }}>
                {!isGuest && (
                  <span style={{ fontSize: '10px', color: isStaff ? 'var(--color-success)' : 'var(--color-text-muted)', marginRight: '6px', alignSelf: 'flex-end', marginBottom: '4px' }}>
                    {isStaff ? '🏠 Host' : '🤖 Pipo'}
                  </span>
                )}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    lineHeight: '1.55',
                    whiteSpace: 'pre-wrap',
                    background: isGuest
                      ? 'linear-gradient(135deg, #e94560, #c0392b)'
                      : isStaff
                      ? 'rgba(34,197,94,0.15)'
                      : 'var(--color-surface-elevated)',
                    color: isGuest ? 'white' : isStaff ? 'var(--color-success)' : 'var(--color-text)',
                    borderBottomRightRadius: isGuest ? '4px' : '16px',
                    borderBottomLeftRadius: !isGuest ? '4px' : '16px',
                    border: isStaff ? '1px solid rgba(34,197,94,0.3)' : undefined,
                  }}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '5px', padding: '12px 14px', background: 'var(--color-surface-elevated)', borderRadius: '16px', borderBottomLeftRadius: '4px', width: 'fit-content' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: '7px', height: '7px', background: '#aaa', borderRadius: '50%', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Type a guest message…"
          rows={1}
          style={{
            flex: 1,
            background: 'var(--color-surface-elevated)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '24px',
            padding: '12px 18px',
            fontSize: '14px',
            color: 'var(--color-text)',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.4',
          }}
        />
        <button
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e94560, #c0392b)',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            flexShrink: 0,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          ➤
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

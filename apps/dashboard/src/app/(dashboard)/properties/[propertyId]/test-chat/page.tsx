'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  escalated?: true;
  escalationReason?: string;
}

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function TestChatPage() {
  const params = useParams();
  const propertyId = params['propertyId'] as string;

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm Pipo, your AI concierge. Ask me anything about the property." },
  ]);
  const [input, setInput] = useState('');
  const [guestName, setGuestName] = useState('Test Guest');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function clearChat() {
    setMessages([
      { role: 'assistant', content: "Hi! I'm Pipo, your AI concierge. Ask me anything about the property." },
    ]);
    setConversationId(null);
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      // Build history from messages (skip welcome, skip messages with escalation banners)
      const history = messages
        .slice(1)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API}/api/properties/${propertyId}/test-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer dev-token',
        },
        body: JSON.stringify({
          guestMessage: msg,
          guestName,
          conversationId: conversationId ?? undefined,
          conversationHistory: history,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        conversationId?: string;
        escalated?: boolean;
        escalationReason?: string;
      };

      if (data.conversationId) setConversationId(data.conversationId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply ?? data.error ?? 'No response',
          ...(data.escalated && { escalated: true as const }),
          ...(data.escalationReason && { escalationReason: data.escalationReason }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Could not reach the API. Is the server running?' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const hasEscalation = messages.some((m) => m.escalated);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', maxWidth: '680px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>🧪 Test Chat</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Simulate a guest conversation to test your AI concierge.
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
          Clear chat
        </button>
      </div>

      {/* Escalation banner */}
      {hasEscalation && (
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
          <span>⚠ This conversation has been escalated for human review.</span>
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
        {messages.map((m, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  fontSize: '14px',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #e94560, #c0392b)'
                    : 'var(--color-surface-elevated)',
                  color: m.role === 'user' ? 'white' : 'var(--color-text)',
                  borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: m.role === 'assistant' ? '4px' : '16px',
                  border: m.escalated ? '1px solid rgba(239,68,68,0.5)' : undefined,
                }}
              >
                {m.content}
              </div>
            </div>
            {m.escalated && m.escalationReason && (
              <div style={{
                marginTop: '4px',
                marginLeft: '2px',
                fontSize: '11px',
                color: 'var(--color-error)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                ⚠ Escalated: {m.escalationReason}
              </div>
            )}
          </div>
        ))}

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

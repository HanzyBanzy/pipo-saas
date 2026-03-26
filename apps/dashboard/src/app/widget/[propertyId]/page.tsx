'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'staff';
  content: string;
  createdAt?: string;
}

interface ApiMessage {
  id: string;
  role: 'GUEST' | 'AI' | 'STAFF' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export default function WidgetPage() {
  const params = useParams();
  const propertyId = params['propertyId'] as string;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Pipo, your Personal House Companion. Ask me anything about the property.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [staffMode, setStaffMode] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore conversationId from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(`widget_conv_${propertyId}`);
    if (stored) {
      setConversationId(stored);
    }
  }, [propertyId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Poll for staff messages when in staff mode
  const pollForStaffMessages = useCallback(async () => {
    if (!conversationId || !staffMode) return;
    try {
      const since = lastPollTime ?? new Date(0).toISOString();
      const res = await fetch(
        `${API}/api/widget/${propertyId}/conversations/${conversationId}/messages?since=${encodeURIComponent(since)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ApiMessage[]; staffMode: boolean };

      setStaffMode(data.staffMode);

      const newStaffMessages = data.messages.filter((m) => m.role === 'STAFF');
      if (newStaffMessages.length > 0) {
        setLastPollTime(newStaffMessages[newStaffMessages.length - 1]?.createdAt ?? null);
        setMessages((prev) => [
          ...prev,
          ...newStaffMessages.map((m) => ({
            id: m.id,
            role: 'staff' as const,
            content: m.content,
            createdAt: m.createdAt,
          })),
        ]);
      }
    } catch {
      // Silently ignore poll errors
    }
  }, [conversationId, staffMode, lastPollTime, propertyId]);

  useEffect(() => {
    if (staffMode && conversationId) {
      pollIntervalRef.current = setInterval(() => {
        void pollForStaffMessages();
      }, 5000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [staffMode, conversationId, pollForStaffMessages]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/widget/${propertyId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestMessage: msg,
          guestName: 'Guest',
          conversationId: conversationId ?? undefined,
        }),
      });

      const data = (await res.json()) as {
        reply?: string | null;
        error?: string;
        conversationId?: string;
        escalated?: boolean;
        staffMode?: boolean;
      };

      if (data.conversationId) {
        setConversationId(data.conversationId);
        sessionStorage.setItem(`widget_conv_${propertyId}`, data.conversationId);
      }

      if (data.staffMode) {
        setStaffMode(true);
        setLastPollTime(new Date().toISOString());
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Connecting you with the host...',
          },
        ]);
      } else if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string }]);
        if (data.escalated) {
          setStaffMode(true);
          setLastPollTime(new Date().toISOString());
        }
      } else if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${data.error}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Could not reach the server. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch property name
  useEffect(() => {
    void (async () => {
      try {
        // We don't have auth here, so just display the propertyId for now
        // In production you'd have a public endpoint for property name
        setPropertyName(propertyId);
      } catch {
        setPropertyName(propertyId);
      }
    })();
  }, [propertyId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        backgroundColor: '#0f1117',
        color: '#e8eaf0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        maxWidth: '480px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(15,17,23,0.97)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e94560, #c0392b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            🏠
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e8eaf0' }}>
              {propertyName || 'Pipo House'}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
              Pipo · Personal House Companion
            </div>
          </div>
          {staffMode && (
            <div
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.4)',
                color: '#4ade80',
                fontWeight: '600',
              }}
            >
              Host Active
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {staffMode && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#4ade80',
              textAlign: 'center',
            }}
          >
            🏠 The host has joined the conversation
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const isStaff = m.role === 'staff';

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              {isStaff && (
                <div
                  style={{
                    fontSize: '11px',
                    color: '#4ade80',
                    fontWeight: '600',
                    marginBottom: '3px',
                    marginLeft: '4px',
                  }}
                >
                  🏠 Host
                </div>
              )}
              <div
                style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: '18px',
                  fontSize: '14px',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: isUser
                    ? 'linear-gradient(135deg, #e94560, #c0392b)'
                    : isStaff
                    ? 'rgba(34,197,94,0.12)'
                    : 'rgba(255,255,255,0.07)',
                  color: isUser ? '#ffffff' : isStaff ? '#4ade80' : '#e8eaf0',
                  borderBottomRightRadius: isUser ? '4px' : '18px',
                  borderBottomLeftRadius: isUser ? '18px' : '4px',
                  border: isStaff ? '1px solid rgba(34,197,94,0.3)' : undefined,
                }}
              >
                {m.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div
              style={{
                display: 'flex',
                gap: '5px',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.07)',
                borderRadius: '18px',
                borderBottomLeftRadius: '4px',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '7px',
                    height: '7px',
                    background: '#9ca3af',
                    borderRadius: '50%',
                    animation: `bounce 1.2s ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(15,17,23,0.97)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={staffMode ? 'Message the host...' : 'Ask anything about the property…'}
            rows={1}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              borderRadius: '22px',
              padding: '11px 16px',
              fontSize: '14px',
              color: '#e8eaf0',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background:
                loading || !input.trim()
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #e94560, #c0392b)',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ➤
          </button>
        </div>

        {/* Share hint */}
        <div
          style={{
            marginTop: '10px',
            fontSize: '11px',
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          Share this page with your guests:{' '}
          <code style={{ color: '#9ca3af' }}>
            {typeof window !== 'undefined' ? window.location.href : `http://localhost:3000/widget/${propertyId}`}
          </code>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
}

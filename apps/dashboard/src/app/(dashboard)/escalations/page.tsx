'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const HEADERS = {
  Authorization: 'Bearer dev-token',
  'x-organization-id': 'dev-org',
  'Content-Type': 'application/json',
};

interface Message {
  id: string;
  role: 'GUEST' | 'AI' | 'STAFF' | 'SYSTEM';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  guestName: string | null;
  channel: string;
  property: { id: string; name: string };
}

interface Escalation {
  id: string;
  conversationId: string;
  trigger: string;
  urgency: string;
  status: string;
  reason: string;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  conversation: Conversation;
}

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: 'badge-error',
  HIGH: 'badge-error',
  MEDIUM: 'badge-neutral',
  LOW: 'badge-neutral',
};

const URGENCY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function ReplyPanel({
  escalation,
  onMessageSent,
}: {
  escalation: Escalation;
  onMessageSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const propertyId = escalation.conversation.property.id;

  async function loadMessages() {
    setLoadingMessages(true);
    try {
      const res = await fetch(
        `${API}/api/properties/${propertyId}/conversations/${escalation.conversationId}`,
        { headers: HEADERS },
      );
      if (res.ok) {
        const data = (await res.json()) as { conversation: { messages: Message[] } };
        const last10 = data.conversation.messages.slice(-10);
        setMessages(last10);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingMessages(false);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && messages.length === 0) {
      void loadMessages();
    }
  }

  async function handleSend() {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      // Send STAFF message
      const msgRes = await fetch(
        `${API}/api/properties/${propertyId}/conversations/${escalation.conversationId}/messages`,
        {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ role: 'STAFF', content: text }),
        },
      );
      if (!msgRes.ok) throw new Error(`HTTP ${msgRes.status}`);

      // Update escalation to IN_PROGRESS if OPEN
      if (escalation.status === 'OPEN') {
        await fetch(`${API}/api/escalations/${escalation.id}`, {
          method: 'PATCH',
          headers: HEADERS,
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        });
      }

      setReply('');
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
      await loadMessages();
      onMessageSent();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  const isActive = escalation.status === 'OPEN' || escalation.status === 'IN_PROGRESS';
  if (!isActive) return null;

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
      <button
        onClick={handleToggle}
        style={{
          fontSize: '13px',
          color: 'var(--color-primary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {open ? '▼' : '▶'} 💬 Reply as Host
      </button>

      {open && (
        <div style={{ marginTop: '12px' }}>
          {/* Conversation history */}
          {loadingMessages ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
              Loading messages…
            </div>
          ) : (
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'var(--color-dark)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                marginBottom: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {messages.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: m.role === 'GUEST' ? 'flex-start' : 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '7px 10px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        whiteSpace: 'pre-wrap',
                        background:
                          m.role === 'GUEST'
                            ? 'var(--color-surface-elevated)'
                            : m.role === 'STAFF'
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(233,69,96,0.12)',
                        color:
                          m.role === 'STAFF'
                            ? 'var(--color-success)'
                            : 'var(--color-text)',
                        border:
                          m.role === 'STAFF'
                            ? '1px solid rgba(34,197,94,0.3)'
                            : undefined,
                      }}
                    >
                      <span style={{ fontSize: '10px', opacity: 0.6 }}>
                        {m.role === 'GUEST' ? '👤 Guest' : m.role === 'STAFF' ? '🏠 Host' : '🤖 AI'}{' '}
                      </span>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Reply input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type your reply to the guest…"
              rows={2}
              style={{
                flex: 1,
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '13px',
                color: 'var(--color-text)',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={sending || !reply.trim()}
              className="btn btn-primary"
              style={{ fontSize: '13px', padding: '8px 14px', flexShrink: 0, alignSelf: 'flex-end' }}
            >
              {sending ? 'Sending…' : 'Send as Host'}
            </button>
          </div>
          {sendError && (
            <div style={{ fontSize: '12px', color: 'var(--color-error)', marginTop: '6px' }}>
              {sendError}
            </div>
          )}
          {sendSuccess && (
            <div style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: '6px' }}>
              ✓ Message sent to guest
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API}/api/escalations?${params.toString()}`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { escalations: Escalation[] };
      setEscalations(data.escalations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(escalationId: string, status: string) {
    setUpdatingId(escalationId);
    try {
      const res = await fetch(`${API}/api/escalations/${escalationId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdatingId(null);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const grouped = URGENCY_ORDER.map((urgency) => ({
    urgency,
    items: escalations.filter((e) => e.urgency === urgency),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Escalations</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Issues flagged for your attention across all properties
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', ''].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={statusFilter === s ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', fontSize: '14px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', padding: '32px', textAlign: 'center' }}>Loading…</div>
      ) : escalations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No escalations</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto' }}>
            When a guest has an urgent issue or the AI can&apos;t help, it will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {grouped.map(({ urgency, items }) => (
            <div key={urgency}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {urgency} ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((esc) => (
                  <div key={esc.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span className={`badge ${URGENCY_COLORS[esc.urgency] ?? 'badge-neutral'}`}>
                            {esc.urgency}
                          </span>
                          <span className="badge badge-neutral">{esc.status.replace('_', ' ')}</span>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {esc.trigger.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                            {timeAgo(esc.createdAt)}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                          {esc.reason}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          {esc.conversation.guestName ?? 'Anonymous Guest'} ·{' '}
                          <Link
                            href={`/properties/${esc.conversation.property.id}` as never}
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {esc.conversation.property.name}
                          </Link>
                        </div>
                        {esc.notes && (
                          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                            Note: {esc.notes}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {esc.status === 'OPEN' && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '5px 10px' }}
                            disabled={updatingId === esc.id}
                            onClick={() => void updateStatus(esc.id, 'IN_PROGRESS')}
                          >
                            Take it
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '5px 10px' }}
                            disabled={updatingId === esc.id}
                            onClick={() => void updateStatus(esc.id, 'DISMISSED')}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                      {esc.status === 'IN_PROGRESS' && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '12px', padding: '5px 10px', flexShrink: 0 }}
                          disabled={updatingId === esc.id}
                          onClick={() => void updateStatus(esc.id, 'RESOLVED')}
                        >
                          Resolve
                        </button>
                      )}
                    </div>

                    {/* Reply as Host panel */}
                    <ReplyPanel escalation={esc} onMessageSent={() => void load()} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

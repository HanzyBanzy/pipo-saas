'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const HEADERS = {
  Authorization: 'Bearer dev-token',
  'x-organization-id': 'dev-org',
};

interface Message {
  role: string;
  content: string;
  createdAt: string;
}

interface Property {
  id: string;
  name: string;
}

interface Conversation {
  id: string;
  propertyId: string;
  channel: string;
  status: string;
  guestName: string | null;
  language: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number; escalations: number };
  messages: Message[];
  property?: Property;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'badge-success',
  RESOLVED: 'badge-neutral',
  ESCALATED: 'badge-error',
  ARCHIVED: 'badge-neutral',
};

const CHANNEL_ICONS: Record<string, string> = {
  WEB_CHAT: '💬',
  WHATSAPP: '📱',
  LINE: '🟩',
  EMAIL: '📧',
  SMS: '📨',
  DIRECT: '🔗',
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch(`${API}/api/conversations?${params.toString()}`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
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

  function truncate(text: string, max = 80) {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Conversations</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          All guest conversations across your properties
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['', 'OPEN', 'ESCALATED', 'RESOLVED', 'ARCHIVED'].map((s) => (
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
      ) : conversations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No conversations yet</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto' }}>
            Conversations will appear here once guests start messaging through your properties.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {conversations.map((conv) => {
            const lastMsg = conv.messages[0];
            return (
              <Link
                key={conv.id}
                href={`/properties/${conv.propertyId}` as never}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '22px', flexShrink: 0 }}>
                    {CHANNEL_ICONS[conv.channel] ?? '💬'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>
                        {conv.guestName ?? 'Anonymous Guest'}
                      </span>
                      {conv.property && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          · {conv.property.name}
                        </span>
                      )}
                      <span
                        className={`badge ${STATUS_COLORS[conv.status] ?? 'badge-neutral'}`}
                        style={{ marginLeft: 'auto' }}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg
                        ? `${lastMsg.role === 'GUEST' ? '👤' : lastMsg.role === 'AI' ? '🤖' : '👔'} ${truncate(lastMsg.content)}`
                        : 'No messages yet'}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {timeAgo(conv.updatedAt)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {conv._count.messages} msg
                      {conv._count.escalations > 0 && (
                        <span style={{ color: 'var(--color-error)', marginLeft: '6px' }}>
                          ⚠ {conv._count.escalations}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

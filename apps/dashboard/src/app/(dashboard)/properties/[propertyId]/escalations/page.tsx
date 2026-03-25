'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const HEADERS = {
  Authorization: 'Bearer dev-token',
  'x-organization-id': 'dev-org',
  'Content-Type': 'application/json',
};

interface Conversation {
  id: string;
  guestName: string | null;
  channel: string;
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

export default function PropertyEscalationsPage() {
  const params = useParams();
  const propertyId = params['propertyId'] as string;

  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, statusFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(
        `${API}/api/properties/${propertyId}/escalations?${params.toString()}`,
        { headers: HEADERS },
      );
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
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Escalations</h2>
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
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔔</div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No escalations</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Urgent guest issues will appear here when the AI flags them for your attention.
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
                          {esc.conversation.guestName ?? 'Anonymous Guest'} · {esc.conversation.channel.replace('_', ' ')}
                        </div>
                        {esc.notes && (
                          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                            Note: {esc.notes}
                          </div>
                        )}
                      </div>

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

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer dev-token',
};

const PERSONALITY_MODES = [
  { value: 'CONCIERGE', label: 'Concierge', description: 'Warm and hospitality-focused' },
  { value: 'FRIENDLY', label: 'Friendly', description: 'Casual and approachable' },
  { value: 'PROFESSIONAL', label: 'Professional', description: 'Formal and efficient' },
  { value: 'MINIMAL', label: 'Minimal', description: 'Short, direct answers only' },
];

interface Property {
  id: string;
  name: string;
  aiEnabled: boolean;
  webChatEnabled: boolean;
  personalityMode: string;
  systemPromptExtra: string | null;
  timezone: string;
  defaultLanguage: string;
}

export default function PropertySettingsPage() {
  const params = useParams();
  const propertyId = params['propertyId'] as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [form, setForm] = useState({
    aiEnabled: true,
    webChatEnabled: true,
    personalityMode: 'CONCIERGE',
    systemPromptExtra: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${API}/api/properties/${propertyId}`, { headers: HEADERS });
      if (res.ok) {
        const { property: p } = (await res.json()) as { property: Property };
        setProperty(p);
        setForm({
          aiEnabled: p.aiEnabled,
          webChatEnabled: p.webChatEnabled,
          personalityMode: p.personalityMode,
          systemPromptExtra: p.systemPromptExtra ?? '',
        });
      }
      setLoading(false);
    })();
  }, [propertyId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({
          aiEnabled: form.aiEnabled,
          webChatEnabled: form.webChatEnabled,
          personalityMode: form.personalityMode,
          systemPromptExtra: form.systemPromptExtra || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Save failed');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '32px' }}>Loading…</div>;
  }

  if (!property) {
    return <div style={{ color: 'var(--color-error)', padding: '32px' }}>Property not found.</div>;
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Property Settings</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{property.name}</p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>AI Concierge</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>AI Enabled</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Allow AI to respond to guest messages
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.aiEnabled}
              onChange={(e) => setForm((p) => ({ ...p, aiEnabled: e.target.checked }))}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Web Chat Widget</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Show chat widget on your property page
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.webChatEnabled}
              onChange={(e) => setForm((p) => ({ ...p, webChatEnabled: e.target.checked }))}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Personality Mode</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {PERSONALITY_MODES.map((mode) => (
            <label
              key={mode.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${form.personalityMode === mode.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              <input
                type="radio"
                name="personalityMode"
                value={mode.value}
                checked={form.personalityMode === mode.value}
                onChange={() => setForm((p) => ({ ...p, personalityMode: mode.value }))}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{mode.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{mode.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Custom AI Instructions</h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          Optional extra instructions appended to the AI system prompt for this property.
        </p>
        <textarea
          className="form-input"
          rows={4}
          placeholder="e.g. Always greet guests in both English and Japanese."
          value={form.systemPromptExtra}
          onChange={(e) => setForm((p) => ({ ...p, systemPromptExtra: e.target.value }))}
          style={{ resize: 'vertical', fontSize: '13px' }}
        />
      </div>

      {error && (
        <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', fontSize: '14px', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', fontSize: '14px', marginBottom: '12px' }}>
          ✓ Settings saved successfully
        </div>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

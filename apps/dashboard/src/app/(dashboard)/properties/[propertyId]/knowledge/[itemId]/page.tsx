'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

const ACCESS_LEVELS = [
  { value: 'PUBLIC', label: 'Public', description: 'Visible to guests' },
  { value: 'AI_READABLE', label: 'AI Readable', description: 'AI uses this to answer guest questions' },
  { value: 'STAFF_ONLY', label: 'Staff Only', description: 'Dashboard only, not visible to AI' },
  { value: 'ENCRYPTED', label: 'Encrypted', description: 'Secret vault — hints only' },
];

const CATEGORIES = [
  { value: 'CHECK_IN', label: 'Check-In' },
  { value: 'CHECK_OUT', label: 'Check-Out' },
  { value: 'HOUSE_RULES', label: 'House Rules' },
  { value: 'WIFI', label: 'WiFi' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'AMENITIES', label: 'Amenities' },
  { value: 'LOCAL_AREA', label: 'Local Area' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'CUSTOM', label: 'Custom' },
];

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer dev-token' };

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  accessLevel: string;
  language: string;
  isPublished: boolean;
}

export default function EditKnowledgeItemPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params['propertyId'] as string;
  const itemId = params['itemId'] as string;

  const [form, setForm] = useState({ title: '', content: '', category: 'FAQ', accessLevel: 'AI_READABLE', language: 'en' });
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${API}/api/properties/${propertyId}/knowledge/${itemId}`, { headers: HEADERS });
      if (res.ok) {
        const { item } = (await res.json()) as { item: KnowledgeItem };
        setForm({ title: item.title, content: item.content, category: item.category, accessLevel: item.accessLevel, language: item.language });
        setIsPublished(item.isPublished);
      }
      setLoading(false);
    })();
  }, [propertyId, itemId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/properties/${propertyId}/knowledge/${itemId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Save failed');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/properties/${propertyId}/knowledge/${itemId}/publish`, {
        method: 'POST',
        headers: HEADERS,
      });
      if (!res.ok) throw new Error('Publish failed');
      setIsPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this knowledge item? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await fetch(`${API}/api/properties/${propertyId}/knowledge/${itemId}`, {
        method: 'DELETE',
        headers: HEADERS,
      });
      router.push(`/properties/${propertyId}/knowledge`);
    } catch {
      setError('Delete failed');
      setDeleting(false);
    }
  }

  if (loading) return <div style={{ color: 'var(--color-text-muted)', padding: '32px' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Edit Knowledge Item</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isPublished ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {isPublished ? 'Published' : 'Draft'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isPublished && (
            <button onClick={() => void handlePublish()} disabled={publishing} className="btn btn-primary" style={{ fontSize: '13px' }}>
              {publishing ? 'Publishing…' : '✓ Publish'}
            </button>
          )}
          <button onClick={() => void handleDelete()} disabled={deleting} className="btn btn-secondary" style={{ fontSize: '13px', color: 'var(--color-error)' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="form-field">
            <label className="form-label">Title *</label>
            <input
              type="text"
              className="form-input"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Content *</label>
            <textarea
              className="form-input"
              rows={10}
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-field">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Language</label>
              <select className="form-input" value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
                <option value="ko">Korean</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Access Level</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ACCESS_LEVELS.map((level) => (
                <label key={level.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${form.accessLevel === level.value ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                  <input type="radio" name="accessLevel" value={level.value} checked={form.accessLevel === level.value} onChange={() => setForm((p) => ({ ...p, accessLevel: level.value }))} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{level.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{level.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {saved && (
            <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', fontSize: '14px' }}>
              ✓ Changes saved successfully
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

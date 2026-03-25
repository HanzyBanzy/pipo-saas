'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';

const ACCESS_LEVELS = [
  { value: 'PUBLIC', label: 'Public', description: 'Visible to guests' },
  { value: 'AI_READABLE', label: 'AI Readable', description: 'AI uses for context, won\'t quote directly' },
  { value: 'STAFF_ONLY', label: 'Staff Only', description: 'Visible in staff dashboard only, not the AI' },
  { value: 'ENCRYPTED', label: 'Encrypted', description: 'Secret vault — only hints shown to guests' },
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

export default function NewKnowledgeItemPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params['propertyId'] as string;

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'FAQ',
    accessLevel: 'AI_READABLE',
    language: 'en',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/properties/${propertyId}/knowledge`, {
        method: 'POST',
        body: JSON.stringify(form),
        organizationId: 'dev-org',
      });
      router.push(`/properties/${propertyId}/knowledge`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Add Knowledge Item</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Add information the AI can use when answering guest questions.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="form-field">
            <label className="form-label">Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Check-in Instructions"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Content *</label>
            <textarea
              className="form-input"
              rows={6}
              placeholder="Enter the information here..."
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-field">
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                style={{ backgroundColor: 'var(--color-surface-elevated)' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Language</label>
              <select
                className="form-input"
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                style={{ backgroundColor: 'var(--color-surface-elevated)' }}
              >
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
                  <input
                    type="radio"
                    name="accessLevel"
                    value={level.value}
                    checked={form.accessLevel === level.value}
                    onChange={() => setForm((p) => ({ ...p, accessLevel: level.value }))}
                  />
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

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

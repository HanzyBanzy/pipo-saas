'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { slugify } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

const TIMEZONES = [
  'UTC',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Australia/Sydney',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'th', label: 'Thai' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
];

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(60)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be lowercase letters, numbers, and hyphens only',
    ),
  timezone: z.string().min(1, 'Please select a timezone'),
  defaultLanguage: z.string().length(2),
});

type FormData = z.infer<typeof formSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

interface Property {
  id: string;
}

export default function NewPropertyPage() {
  const router = useRouter();
  const orgId = 'dev-org';

  const [form, setForm] = useState<FormData>({
    name: '',
    slug: '',
    timezone: 'Asia/Tokyo',
    defaultLanguage: 'en',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugify(value),
    }));
  }

  function handleField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = formSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const [key, msgs] of Object.entries(
        result.error.flatten().fieldErrors,
      )) {
        fieldErrors[key as keyof FormData] = msgs?.[0] ?? 'Invalid value';
      }
      setErrors(fieldErrors);
      return;
    }

    if (!orgId) {
      setServerError('No organization selected. Please select an organization first.');
      return;
    }

    setSubmitting(true);
    try {
      const { property } = await apiRequest<{ property: Property }>(
        '/api/properties',
        {
          method: 'POST',
          body: JSON.stringify(result.data),
          organizationId: orgId,
        },
      );
      router.push(`/properties/${property.id}`);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to create property',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '4px',
          }}
        >
          Add Property
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Create a new property and configure its AI concierge.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Property name */}
          <div className="form-field">
            <label htmlFor="name" className="form-label">
              Property Name *
            </label>
            <input
              id="name"
              type="text"
              className="form-input"
              placeholder="e.g. Susukino Downtown Apartment"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={submitting}
            />
            {errors.name && (
              <span className="form-error">{errors.name}</span>
            )}
          </div>

          {/* Slug */}
          <div className="form-field">
            <label htmlFor="slug" className="form-label">
              Slug *
            </label>
            <input
              id="slug"
              type="text"
              className="form-input"
              placeholder="e.g. susukino-apt"
              value={form.slug}
              onChange={(e) =>
                handleField('slug', e.target.value.toLowerCase())
              }
              disabled={submitting}
            />
            <span
              style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
            >
              Used in URLs and identifiers. Auto-generated from name.
            </span>
            {errors.slug && (
              <span className="form-error">{errors.slug}</span>
            )}
          </div>

          {/* Timezone */}
          <div className="form-field">
            <label htmlFor="timezone" className="form-label">
              Timezone *
            </label>
            <select
              id="timezone"
              className="form-input"
              value={form.timezone}
              onChange={(e) => handleField('timezone', e.target.value)}
              disabled={submitting}
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            {errors.timezone && (
              <span className="form-error">{errors.timezone}</span>
            )}
          </div>

          {/* Default language */}
          <div className="form-field">
            <label htmlFor="defaultLanguage" className="form-label">
              Default Language *
            </label>
            <select
              id="defaultLanguage"
              className="form-input"
              value={form.defaultLanguage}
              onChange={(e) =>
                handleField('defaultLanguage', e.target.value)
              }
              disabled={submitting}
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            {errors.defaultLanguage && (
              <span className="form-error">{errors.defaultLanguage}</span>
            )}
          </div>

          {serverError && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-error)',
                fontSize: '14px',
              }}
            >
              {serverError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {submitting ? 'Creating...' : 'Create Property'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

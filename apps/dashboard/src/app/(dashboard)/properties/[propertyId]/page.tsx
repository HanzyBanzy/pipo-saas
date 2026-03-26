import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Property {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  timezone: string;
  aiEnabled: boolean;
  webChatEnabled: boolean;
  personalityMode: string;
}

interface Stats {
  totalConversations: number;
  openEscalations: number;
  publishedKbItems: number;
  conversationsToday: number;
}


async function fetchProperty(
  propertyId: string,
  organizationId: string,
  token: string,
): Promise<Property | null> {
  const apiUrl =
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/properties/${propertyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': organizationId,
    },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { property: Property };
  return data.property;
}

async function fetchStats(
  propertyId: string,
  organizationId: string,
  token: string,
): Promise<Stats | null> {
  const apiUrl =
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/properties/${propertyId}/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': organizationId,
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { stats: Stats };
  return data.stats;
}


export default async function PropertyOverviewPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const token = 'dev-token';
  const organizationId = 'dev-org';

  const [property, stats] = await Promise.all([
    fetchProperty(propertyId, organizationId, token),
    fetchStats(propertyId, organizationId, token),
  ]);

  if (!property) notFound();

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '700',
              marginBottom: '4px',
            }}
          >
            {property.name}
          </h1>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span
              className={`badge ${property.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}
            >
              {property.status}
            </span>
            <span
              style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}
            >
              {property.timezone}
            </span>
          </div>
        </div>

        <Link
          href={`/properties/${propertyId}/test-chat`}
          className="btn btn-secondary"
        >
          Test Chat
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {[
            {
              label: 'Conversations Today',
              value: stats.conversationsToday,
              color: 'var(--color-primary)',
            },
            {
              label: 'Open Escalations',
              value: stats.openEscalations,
              color:
                stats.openEscalations > 0
                  ? 'var(--color-error)'
                  : 'var(--color-success)',
            },
            {
              label: 'KB Items Published',
              value: stats.publishedKbItems,
              color: 'var(--color-info)',
            },
            {
              label: 'Total Conversations',
              value: stats.totalConversations,
              color: 'var(--color-text)',
            },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ padding: '16px' }}>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: stat.color,
                  marginBottom: '4px',
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI status */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          Personal House Companion Settings
        </h2>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div
              style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
            >
              AI Enabled
            </div>
            <span
              className={`badge ${property.aiEnabled ? 'badge-success' : 'badge-neutral'}`}
            >
              {property.aiEnabled ? 'On' : 'Off'}
            </span>
          </div>
          <div>
            <div
              style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
            >
              Web Chat
            </div>
            <span
              className={`badge ${property.webChatEnabled ? 'badge-success' : 'badge-neutral'}`}
            >
              {property.webChatEnabled ? 'On' : 'Off'}
            </span>
          </div>
          <div>
            <div
              style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
            >
              Personality Mode
            </div>
            <span className="badge badge-info">{property.personalityMode}</span>
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <Link
            href={`/properties/${propertyId}/settings`}
            style={{
              fontSize: '13px',
              color: 'var(--color-primary)',
              textDecoration: 'underline',
            }}
          >
            Configure settings
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2
          style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            href={`/properties/${propertyId}/knowledge`}
            className="btn btn-secondary"
          >
            Manage Knowledge Base
          </Link>
          <Link
            href={`/properties/${propertyId}/escalations`}
            className="btn btn-secondary"
          >
            View Escalations
          </Link>
          <Link
            href={`/properties/${propertyId}/test-chat`}
            className="btn btn-primary"
          >
            Test Chat
          </Link>
        </div>
        <div style={{ marginTop: '8px', padding: '12px', background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Guest Chat Link</div>
          <code style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
            http://localhost:3000/widget/{propertyId}
          </code>
        </div>
      </div>
    </div>
  );
}

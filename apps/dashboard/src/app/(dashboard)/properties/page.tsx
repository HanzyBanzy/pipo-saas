import Link from 'next/link';

interface Property {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  timezone: string;
  aiEnabled: boolean;
  webChatEnabled: boolean;
  _count: {
    conversations: number;
  };
}

async function fetchProperties(
  organizationId: string,
  token: string,
): Promise<Property[]> {
  const apiUrl =
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

  const res = await fetch(`${apiUrl}/api/properties`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': organizationId,
    },
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as { properties: Property[] };
  return data.properties;
}

function StatusBadge({ status }: { status: Property['status'] }) {
  const styles: Record<
    Property['status'],
    { label: string; className: string }
  > = {
    ACTIVE: { label: 'Active', className: 'badge badge-success' },
    INACTIVE: { label: 'Inactive', className: 'badge badge-neutral' },
    SUSPENDED: { label: 'Suspended', className: 'badge badge-error' },
  };
  const s = styles[status] ?? styles.INACTIVE;
  return <span className={s.className}>{s.label}</span>;
}

export default async function PropertiesPage() {
  // Auth bypassed for local dev — will restore with Clerk
  const properties = await fetchProperties('dev-org', 'dev-token');

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '4px',
            }}
          >
            Properties
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Manage your rental properties and their Personal House Companion settings
          </p>
        </div>
        <Link href="/properties/new" className="btn btn-primary">
          + Add Property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '60px 24px' }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏠</div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            No properties yet
          </h2>
          <p
            style={{
              color: 'var(--color-text-muted)',
              marginBottom: '24px',
              maxWidth: '360px',
              margin: '0 auto 24px',
            }}
          >
            Add your first property to start using Pipo&apos;s Personal House Companion for
            your guests.
          </p>
          <Link href="/properties/new" className="btn btn-primary">
            + Add Your First Property
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '4px',
                      }}
                    >
                      {property.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      /{property.slug}
                    </span>
                  </div>
                  <StatusBadge status={property.status} />
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: 'var(--color-text)',
                      }}
                    >
                      {property._count.conversations}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Conversations
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginLeft: 'auto',
                    }}
                  >
                    {property.aiEnabled && (
                      <span
                        className="badge badge-info"
                        style={{ fontSize: '11px' }}
                      >
                        AI On
                      </span>
                    )}
                    {property.webChatEnabled && (
                      <span
                        className="badge badge-success"
                        style={{ fontSize: '11px' }}
                      >
                        Chat On
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    marginTop: '8px',
                  }}
                >
                  {property.timezone}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

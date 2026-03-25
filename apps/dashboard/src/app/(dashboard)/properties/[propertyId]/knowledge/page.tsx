import Link from 'next/link';
import { getAccessLevelBadge } from '@/lib/utils';
import { ItemActions } from './ItemActions';

type Category =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'HOUSE_RULES'
  | 'WIFI'
  | 'PARKING'
  | 'AMENITIES'
  | 'LOCAL_AREA'
  | 'EMERGENCY'
  | 'FAQ'
  | 'CUSTOM';

type AccessLevel = 'PUBLIC' | 'AI_READABLE' | 'STAFF_ONLY' | 'ENCRYPTED';

interface KnowledgeItem {
  id: string;
  title: string;
  category: Category;
  accessLevel: AccessLevel;
  isPublished: boolean;
  publishedAt: string | null;
  language: string;
  updatedAt: string;
  _count: { versions: number };
}

const CATEGORY_LABELS: Record<Category, string> = {
  CHECK_IN: 'Check-In',
  CHECK_OUT: 'Check-Out',
  HOUSE_RULES: 'House Rules',
  WIFI: 'WiFi',
  PARKING: 'Parking',
  AMENITIES: 'Amenities',
  LOCAL_AREA: 'Local Area',
  EMERGENCY: 'Emergency',
  FAQ: 'FAQ',
  CUSTOM: 'Custom',
};

async function fetchKnowledgeItems(
  propertyId: string,
  organizationId: string,
  token: string,
): Promise<KnowledgeItem[]> {
  const apiUrl =
    process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const res = await fetch(
    `${apiUrl}/api/properties/${propertyId}/knowledge`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': organizationId,
      },
      next: { revalidate: 15 },
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items: KnowledgeItem[] };
  return data.items;
}

function groupByCategory(items: KnowledgeItem[]): Map<Category, KnowledgeItem[]> {
  const map = new Map<Category, KnowledgeItem[]>();
  for (const item of items) {
    const existing = map.get(item.category) ?? [];
    existing.push(item);
    map.set(item.category, existing);
  }
  return map;
}

export default async function KnowledgeBasePage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{
    category?: string;
    accessLevel?: string;
  }>;
}) {
  const { propertyId } = await params;
  const sp = await searchParams;
  const token = 'dev-token';
  const organizationId = 'dev-org';

  const allItems = await fetchKnowledgeItems(
    propertyId,
    organizationId,
    token,
  );

  // Apply filters
  const filtered = allItems.filter((item) => {
    if (sp.category && item.category !== sp.category) return false;
    if (sp.accessLevel && item.accessLevel !== sp.accessLevel) return false;
    return true;
  });

  const grouped = groupByCategory(filtered);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>
            Knowledge Base
          </h2>
          <p
            style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}
          >
            {allItems.length} items,{' '}
            {allItems.filter((i) => i.isPublished).length} published
          </p>
        </div>
        <Link
          href={`/properties/${propertyId}/knowledge/new`}
          className="btn btn-primary"
        >
          + Add Item
        </Link>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href={`/properties/${propertyId}/knowledge`}
          className={`badge ${!sp.category && !sp.accessLevel ? 'badge-info' : 'badge-neutral'}`}
          style={{ cursor: 'pointer', padding: '6px 12px' }}
        >
          All
        </Link>
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
          <Link
            key={cat}
            href={`/properties/${propertyId}/knowledge?category=${cat}`}
            className={`badge ${sp.category === cat ? 'badge-info' : 'badge-neutral'}`}
            style={{ cursor: 'pointer', padding: '6px 12px' }}
          >
            {CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>

      {/* Access level filter */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        {(['PUBLIC', 'AI_READABLE', 'STAFF_ONLY', 'ENCRYPTED'] as AccessLevel[]).map(
          (level) => {
            const badge = getAccessLevelBadge(level);
            return (
              <Link
                key={level}
                href={`/properties/${propertyId}/knowledge?accessLevel=${level}`}
                style={{
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  border: `1px solid ${sp.accessLevel === level ? badge.color : 'var(--color-border)'}`,
                  color:
                    sp.accessLevel === level ? badge.color : 'var(--color-text-muted)',
                  backgroundColor:
                    sp.accessLevel === level
                      ? `${badge.color}1a`
                      : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {badge.emoji} {badge.label}
              </Link>
            );
          },
        )}
      </div>

      {/* Items grouped by category */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>
            No knowledge items found.{' '}
            <Link
              href={`/properties/${propertyId}/knowledge/new`}
              style={{ color: 'var(--color-primary)' }}
            >
              Add the first item.
            </Link>
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                }}
              >
                {CATEGORY_LABELS[category]}
              </h3>
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                {items.map((item, idx) => {
                  const badge = getAccessLevelBadge(item.accessLevel);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderTop:
                          idx > 0 ? '1px solid var(--color-border)' : 'none',
                        backgroundColor: 'var(--color-surface)',
                        gap: '12px',
                      }}
                    >
                      {/* Status indicator */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: item.isPublished
                            ? 'var(--color-success)'
                            : 'var(--color-text-muted)',
                          flexShrink: 0,
                        }}
                      />

                      {/* Title */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: '500',
                            fontSize: '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          {item._count.versions} version
                          {item._count.versions !== 1 ? 's' : ''}
                          {item.isPublished ? ' · Published' : ' · Draft'}
                        </div>
                      </div>

                      {/* Access level badge */}
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '500',
                          color: badge.color,
                          backgroundColor: `${badge.color}1a`,
                          border: `1px solid ${badge.color}33`,
                          flexShrink: 0,
                        }}
                      >
                        {badge.emoji} {badge.label}
                      </span>

                      <ItemActions
                        propertyId={propertyId}
                        itemId={item.id}
                        isPublished={item.isPublished}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export function ItemActions({
  propertyId,
  itemId,
  isPublished,
}: {
  propertyId: string;
  itemId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [published, setPublished] = useState(isPublished);
  const [loading, setLoading] = useState(false);

  async function publish() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/properties/${propertyId}/knowledge/${itemId}/publish`, {
        method: 'POST',
        headers: { Authorization: 'Bearer dev-token' },
      });
      if (res.ok) {
        setPublished(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
      {!published && (
        <button
          onClick={() => void publish()}
          disabled={loading}
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          {loading ? '…' : 'Publish'}
        </button>
      )}
      <Link
        href={`/properties/${propertyId}/knowledge/${itemId}`}
        className="btn btn-secondary"
        style={{ padding: '4px 10px', fontSize: '12px' }}
      >
        Edit
      </Link>
    </div>
  );
}

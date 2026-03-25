'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import type { Route } from 'next';

const tabs = [
  { href: '', label: 'Overview' },
  { href: '/knowledge', label: 'Knowledge Base' },
  { href: '/test-chat', label: '🧪 Test Chat' },
  { href: '/escalations', label: 'Escalations' },
  { href: '/settings', label: 'Settings' },
];

export default function PropertyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const propertyId = params['propertyId'] as string;
  const basePath = `/properties/${propertyId}`;

  return (
    <div>
      {/* Sub-navigation tabs */}
      <nav
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '24px',
          paddingBottom: '0',
        }}
      >
        {tabs.map((tab) => {
          const href = `${basePath}${tab.href}`;
          const isActive =
            tab.href === ''
              ? pathname === basePath
              : pathname.startsWith(href);

          return (
            <Link
              key={tab.href}
              href={href as Route}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                color: isActive
                  ? 'var(--color-primary)'
                  : 'var(--color-text-muted)',
                borderBottom: isActive
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s',
                textDecoration: 'none',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

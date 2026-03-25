'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems: { href: '/properties' | '/conversations' | '/escalations' | '/settings'; label: string; icon: string }[] = [
  { href: '/properties', label: 'Properties', icon: '🏠' },
  { href: '/conversations', label: 'Conversations', icon: '💬' },
  { href: '/escalations', label: 'Escalations', icon: '🔔' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-dark)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 16px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--color-primary)',
            }}
          >
            Pipo House
          </span>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              marginTop: '2px',
            }}
          >
            AI Concierge Platform
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '2px',
                  color: isActive
                    ? 'var(--color-text)'
                    : 'var(--color-text-muted)',
                  backgroundColor: isActive
                    ? 'var(--color-surface-elevated)'
                    : 'transparent',
                  fontWeight: isActive ? '500' : '400',
                  transition: 'background-color 0.15s, color 0.15s',
                  fontSize: '14px',
                }}
              >
                <span style={{ fontSize: '16px', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom area */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--color-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', color: 'white', fontWeight: '600',
            }}>P</div>
            <span
              style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}
            >
              Pipo House
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: 'var(--topbar-height)',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>Pipo House</span>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: '32px 24px',
            maxWidth: '1200px',
            width: '100%',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

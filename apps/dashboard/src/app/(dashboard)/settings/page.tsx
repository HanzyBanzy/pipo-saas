export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
        Settings
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '32px' }}>
        Account and platform configuration
      </p>
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Organization
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Organization Name
            </label>
            <div style={{ fontSize: '14px' }}>Pipo House</div>
          </div>
          <div>
            <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Plan
            </label>
            <div style={{ fontSize: '14px' }}>Development</div>
          </div>
        </div>
      </div>
    </div>
  );
}

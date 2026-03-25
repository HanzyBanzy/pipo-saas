import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-dark)',
        gap: '32px',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--color-primary)',
            marginBottom: '8px',
          }}
        >
          Pipo House
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          AI Concierge Platform — Create your account
        </p>
      </div>
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#e94560',
            colorBackground: '#16213e',
            colorText: '#e8eaf0',
            colorTextSecondary: '#8892a4',
            colorInputBackground: '#1e2d4d',
            colorInputText: '#e8eaf0',
            borderRadius: '10px',
          },
        }}
      />
    </main>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pipo House — AI Concierge Dashboard',
  description: 'Manage your properties and AI concierge settings',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

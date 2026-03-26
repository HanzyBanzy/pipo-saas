import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pipo House — Personal House Companion Dashboard',
  description: 'Manage your properties and Personal House Companion settings',
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

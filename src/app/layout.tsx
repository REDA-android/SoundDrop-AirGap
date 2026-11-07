import type { Metadata, Viewport } from 'next';
import './globals.css';
import '../../sound-drop-native/desktop-ui/src/styles/aesthetics.css';

export const metadata: Metadata = {
  title: 'Sound Drop | Offline Acoustic & Ultrasonic AirDrop',
  description:
    '100% Offline peer-to-peer acoustic file and text transfer over physical sound waves with zero network hardware.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sound Drop',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#06B6D4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background text-slate-100 flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';

// Standard sans (Inter) for everything, including headings — professional,
// uniform typography instead of a separate display face. JetBrains Mono is
// still available but reserved for code-like content (file paths, launch
// commands, topic names), not general UI chrome.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UpFreq Robotics — Agentic ROS 2 Codebase & Parameter Intelligence Platform',
  description: 'Enterprise platform for auditing robotics GitHub repositories, ROS 2 URDF transforms, Nav2 stack parameters, and Gazebo simulation models.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full flex flex-col bg-sand-950 text-sand-50 font-sans antialiased">
        <AuthProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

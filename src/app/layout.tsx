import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';

// Standard sans (Plus Jakarta Sans) for everything, including headings —
// matches the client-approved reference design (rounded geometric grotesque,
// heavy weights for titles). Used uniformly instead of a separate display
// face. JetBrains Mono is still available but reserved for code-like content
// (file paths, launch commands, topic names), not general UI chrome.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
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
  title: 'UpFreq — Agentic ROS 2 Codebase & Parameter Intelligence Platform',
  description: 'Enterprise platform for auditing robotics GitHub repositories, ROS 2 URDF transforms, Nav2 stack parameters, and Gazebo simulation models.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
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

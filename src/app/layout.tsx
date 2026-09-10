import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { withAuth } from '@workos-inc/authkit-nextjs';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { ToastProvider } from '@/components/ui/toast';

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await withAuth();

  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full flex flex-col bg-sand-950 text-sand-50 font-sans antialiased">
        <ToastProvider>
          <ConfirmProvider>
            <AppLayout user={user}>
              {children}
            </AppLayout>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

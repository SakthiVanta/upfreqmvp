import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
      <body className="min-h-full flex flex-col bg-[#f4f4f5] text-slate-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <AuthProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

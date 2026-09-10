import Link from 'next/link';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { ShieldCheck, ArrowRight, LogIn, UserPlus } from 'lucide-react';

export default async function LoginPage() {
  const { user } = await withAuth();

  return (
    <div className="max-w-md mx-auto py-12 font-sans space-y-6 px-4">

      <div className="minimal-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-primary text-sand-950 flex items-center justify-center font-bold text-base">
              UF
            </div>
          </Link>
          <h1 className="text-xl font-display font-extrabold text-sand-50 tracking-tight">
            {user ? 'Welcome back to UpFreq' : 'Sign In to UpFreq'}
          </h1>
        </div>

        {user ? (
          <div className="bg-emerald-light border border-emerald-border p-5 rounded-lg text-xs text-emerald-text space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 font-bold text-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-primary" />
              AUTHENTICATED AS {user.email}
            </div>
            <p className="text-sand-300">Your session is active. Proceed to the application workspace.</p>
            <Link
              href="/projects"
              className="btn-emerald-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 font-semibold"
            >
              Open Robot Projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="bg-sand-950 border border-sand-800 p-4 rounded-lg text-sand-400 leading-relaxed">
              UpFreq uses WorkOS AuthKit for sign-in — this is also what lets you securely connect your UpFreq account to Claude, ChatGPT, and other AI agents via MCP.
            </div>

            <a
              href="/api/auth/sign-in"
              className="btn-emerald-primary w-full py-3 text-sm flex items-center justify-center gap-2.5 font-bold"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </a>

            <a
              href="/api/auth/sign-up"
              className="w-full py-3 text-sm flex items-center justify-center gap-2.5 font-bold border border-sand-700 text-sand-200 hover:bg-sand-800 transition-colors rounded-lg"
            >
              <UserPlus className="h-4 w-4" />
              Create an Account
            </a>
          </div>
        )}

      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { Lock, Mail, Key, ShieldCheck, ArrowRight, UserCheck, UserPlus, Building2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGithub, loginWithCredentials, isAuthenticated, user } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [authTab, setAuthTab] = useState<'github' | 'credentials'>('github');
  
  const [name, setName] = useState('Ekumen Robotics Engineer');
  const [username, setUsername] = useState('ekumen_engineer@upfreq.com');
  const [password, setPassword] = useState('••••••••••••');
  const [organization, setOrganization] = useState('Ekumen Labs');

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginWithCredentials(username, password);
    router.push('/dashboard');
  };

  const handleGithubClick = () => {
    loginWithGithub();
    router.push('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto py-12 font-sans space-y-6">
      
      <div className="minimal-card p-8 bg-white border-slate-200 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-base shadow-xs border border-slate-800">
              UF
            </div>
          </Link>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'signin' ? 'Sign In to UpFreq Robotics' : 'Create UpFreq Robotics Account'}
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            {mode === 'signin' 
              ? 'Access your agentic workspace & ROS 2 parameter engine'
              : 'Register your robotics team to audit GitHub packages & ROS 2 URDFs'
            }
          </p>
        </div>

        {/* Mode Switcher Tabs (Sign In vs Sign Up) */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 font-mono text-xs">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-md font-semibold transition-all ${
              mode === 'signin'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-md font-semibold transition-all ${
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account (Sign Up)
          </button>
        </div>

        {isAuthenticated ? (
          <div className="bg-emerald-light border border-emerald-border p-5 rounded-lg text-xs font-mono text-emerald-text space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 font-bold text-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-primary" />
              AUTHENTICATED AS {user?.username}
            </div>
            <p className="text-slate-600">Your session is active. Proceed to the application workspace.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-emerald-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 font-semibold"
            >
              Open Robotics Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Auth Method Switcher Tabs (GitHub vs Credentials) */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 font-mono text-xs">
              <button
                onClick={() => setAuthTab('github')}
                className={`flex-1 py-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  authTab === 'github'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GithubIcon className="h-3.5 w-3.5 fill-current" />
                GitHub OAuth
              </button>

              <button
                onClick={() => setAuthTab('credentials')}
                className={`flex-1 py-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  authTab === 'credentials'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 text-emerald-primary" />
                {mode === 'signin' ? 'Email / Password' : 'New Account Details'}
              </button>
            </div>

            {/* GitHub OAuth Flow */}
            {authTab === 'github' && (
              <div className="space-y-4 font-mono text-xs">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-slate-600 space-y-2">
                  <span className="font-bold text-slate-900 block">GitHub Organization Authentication:</span>
                  <p className="leading-relaxed">Connect your GitHub account to directly audit public or private ROS 2 repositories without manual code uploads.</p>
                </div>

                <button
                  onClick={handleGithubClick}
                  className="btn-emerald-primary w-full py-3 text-xs flex items-center justify-center gap-2.5 font-bold shadow-xs"
                >
                  <GithubIcon className="h-4 w-4 fill-current" />
                  {mode === 'signin' ? 'Sign In with GitHub OAuth' : 'Sign Up with GitHub OAuth'}
                </button>
              </div>
            )}

            {/* Email / Password Form (Sign In or Sign Up) */}
            {authTab === 'credentials' && (
              <form onSubmit={handleAuthSubmit} className="space-y-4 font-mono text-xs">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5 text-emerald-primary" />
                        Full Name / Engineer Name:
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-emerald-primary focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-primary" />
                        Organization / Lab Name:
                      </label>
                      <input
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="Autonomous Systems Lab"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-emerald-primary focus:bg-white"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-emerald-primary" />
                    Work Email Address:
                  </label>
                  <input
                    type="email"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="engineer@upfreq.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-emerald-primary focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-emerald-primary" />
                    Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-emerald-primary focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-emerald-primary w-full py-3 text-xs flex items-center justify-center gap-2 font-bold shadow-xs"
                >
                  {mode === 'signin' ? 'Sign In to Workspace' : 'Create Account & Start Auditing'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

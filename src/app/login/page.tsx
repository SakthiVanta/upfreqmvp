'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { Mail, Key, ShieldCheck, ArrowRight, UserCheck, UserPlus, Building2 } from 'lucide-react';

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
    router.push('/projects');
  };

  const handleGithubClick = () => {
    loginWithGithub();
    router.push('/projects');
  };

  return (
    <div className="max-w-md mx-auto py-12 font-sans space-y-6 px-4">

      <div className="minimal-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-primary text-sand-950 flex items-center justify-center font-bold text-base shadow-xs">
              UF
            </div>
          </Link>
          <h1 className="text-xl font-display font-extrabold text-sand-50 tracking-tight">
            {mode === 'signin' ? 'Sign In to UpFreq Robotics' : 'Create UpFreq Robotics Account'}
          </h1>
          <p className="text-xs text-sand-500">
            {mode === 'signin'
              ? 'Access your agentic workspace & ROS 2 parameter engine'
              : 'Register your robotics team to audit GitHub packages & ROS 2 URDFs'
            }
          </p>
        </div>

        {/* Mode Switcher Tabs (Sign In vs Sign Up) */}
        <div className="flex bg-sand-950 p-1 rounded-lg border border-sand-800 text-xs">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-md font-semibold whitespace-nowrap transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-emerald-primary text-sand-950 font-bold'
                : 'text-sand-300 hover:text-sand-100'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-md font-semibold whitespace-nowrap transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-emerald-primary text-sand-950 font-bold'
                : 'text-sand-300 hover:text-sand-100'
            }`}
          >
            Sign Up
          </button>
        </div>

        {isAuthenticated ? (
          <div className="bg-emerald-light border border-emerald-border p-5 rounded-lg text-xs text-emerald-text space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 font-bold text-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-primary" />
              AUTHENTICATED AS {user?.username}
            </div>
            <p className="text-sand-300">Your session is active. Proceed to the application workspace.</p>
            <button
              onClick={() => router.push('/projects')}
              className="btn-emerald-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 font-semibold cursor-pointer"
            >
              Open Robot Projects
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Auth Method Switcher Tabs (GitHub vs Credentials) */}
            <div className="flex bg-sand-950 p-1 rounded-lg border border-sand-800 text-xs">
              <button
                onClick={() => setAuthTab('github')}
                className={`flex-1 py-2 rounded-md font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'github'
                    ? 'bg-emerald-primary text-sand-950'
                    : 'text-sand-300 hover:text-sand-100'
                }`}
              >
                <GithubIcon className={`h-3.5 w-3.5 fill-current ${authTab === 'github' ? '' : 'text-emerald-primary'}`} />
                GitHub OAuth
              </button>

              <button
                onClick={() => setAuthTab('credentials')}
                className={`flex-1 py-2 rounded-md font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'credentials'
                    ? 'bg-emerald-primary text-sand-950'
                    : 'text-sand-300 hover:text-sand-100'
                }`}
              >
                <UserCheck className={`h-3.5 w-3.5 ${authTab === 'credentials' ? '' : 'text-emerald-primary'}`} />
                {mode === 'signin' ? 'Email / Password' : 'New Account Details'}
              </button>
            </div>

            {/* GitHub OAuth Flow */}
            {authTab === 'github' && (
              <div className="space-y-4 text-xs">
                <div className="bg-sand-950 border border-sand-800 p-4 rounded-lg text-sand-400 space-y-2">
                  <span className="font-bold text-sand-100 block">GitHub Organization Authentication:</span>
                  <p className="leading-relaxed">Connect your GitHub account to directly audit public or private ROS 2 repositories without manual code uploads.</p>
                </div>

                <button
                  onClick={handleGithubClick}
                  className="btn-emerald-primary w-full py-3 text-xs flex items-center justify-center gap-2.5 font-bold cursor-pointer"
                >
                  <GithubIcon className="h-4 w-4 fill-current" />
                  {mode === 'signin' ? 'Sign In with GitHub OAuth' : 'Sign Up with GitHub OAuth'}
                </button>
              </div>
            )}

            {/* Email / Password Form (Sign In or Sign Up) */}
            {authTab === 'credentials' && (
              <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="text-sand-300 font-bold mb-1 flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5 text-emerald-primary" />
                        Full Name / Engineer Name:
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
                      />
                    </div>

                    <div>
                      <label className="text-sand-300 font-bold mb-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-primary" />
                        Organization / Lab Name:
                      </label>
                      <input
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="Autonomous Systems Lab"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-sand-300 font-bold mb-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-emerald-primary" />
                    Work Email Address:
                  </label>
                  <input
                    type="email"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="engineer@upfreq.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
                  />
                </div>

                <div>
                  <label className="text-sand-300 font-bold mb-1 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-emerald-primary" />
                    Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-emerald-primary w-full py-3 text-xs flex items-center justify-center gap-2 font-bold cursor-pointer"
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

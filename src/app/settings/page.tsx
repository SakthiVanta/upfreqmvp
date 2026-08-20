'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, AlertTriangle, Bot, Eye, EyeOff, Trash2, KeyRound, Gauge, Activity } from 'lucide-react';
import { PROVIDERS, DEFAULT_MODEL_BY_PROVIDER, ANTHROPIC_EFFORT_LEVELS, ProviderId, AgentSettings } from '@/lib/agent/types';
import { useConfirm } from '@/components/ui/confirm-dialog';

const CUSTOM_MODEL_VALUE = '__custom__';

interface ModelOption {
  id: string;
  label: string;
  isDefault: boolean;
}

interface ProviderKeyStatus {
  configured: boolean;
  source: 'user' | 'env' | 'none';
  preview: string | null;
}

interface AuditRunRecord {
  id: string;
  repoUrl: string;
  provider: string;
  model: string;
  usedAgenticAnalysis: boolean;
  toolCallCount: number | null;
  apiCallCount: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const confirm = useConfirm();
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [configured, setConfigured] = useState<Record<ProviderId, ProviderKeyStatus> | null>(null);
  // Model dropdown options come from the DB-seeded `provider_models` table
  // (see src/lib/db/provider-models.ts) — not hardcoded here, so re-seeding
  // after a provider ships new models updates this page with no code change.
  const [models, setModels] = useState<Record<ProviderId, ModelOption[]> | null>(null);
  const [customModel, setCustomModel] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isRemovingKey, setIsRemovingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyJustSaved, setKeyJustSaved] = useState(false);

  const [auditRuns, setAuditRuns] = useState<AuditRunRecord[] | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSettings(data.settings);
        setConfigured(data.configured);
        setModels(data.models);
        const options: ModelOption[] = data.models[data.settings.provider as ProviderId] || [];
        const preset = options.some(m => m.id === data.settings.model);
        setUseCustomModel(!preset);
        if (!preset) setCustomModel(data.settings.model);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));

    fetch('/api/telemetry')
      .then(res => res.json())
      .then(data => setAuditRuns(data.runs || []))
      .catch(() => setAuditRuns([]));
  }, []);

  const selectProvider = (provider: ProviderId) => {
    if (!settings) return;
    const options = models?.[provider] || [];
    const model = options.find(m => m.isDefault)?.id || DEFAULT_MODEL_BY_PROVIDER[provider];
    setSettings({ provider, model });
    setUseCustomModel(false);
    setCustomModel('');
    setApiKeyInput('');
    setShowApiKey(false);
    setKeyError(null);
  };

  const selectModel = (value: string) => {
    if (!settings) return;
    if (value === CUSTOM_MODEL_VALUE) {
      setUseCustomModel(true);
      setSettings({ ...settings, model: customModel || settings.model });
      return;
    }
    setUseCustomModel(false);
    setSettings({ ...settings, model: value });
  };

  const handleCustomModelChange = (value: string) => {
    setCustomModel(value);
    if (settings) setSettings({ ...settings, model: value });
  };

  const handleSave = async () => {
    if (!settings || !settings.model.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings.');
      setSettings(data.settings);
      setConfigured(data.configured);
      setModels(data.models);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKey = async () => {
    if (!settings || !apiKeyInput.trim() || isSavingKey) return;
    setIsSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch(`/api/settings/keys/${settings.provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save API key.');
      setConfigured(prev => (prev ? { ...prev, [settings.provider]: data.status } : prev));
      setApiKeyInput('');
      setShowApiKey(false);
      setKeyJustSaved(true);
      setTimeout(() => setKeyJustSaved(false), 2500);
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!settings || isRemovingKey) return;
    const ok = await confirm({
      title: 'Remove API Key',
      message: `Remove your saved ${PROVIDERS.find(p => p.id === settings.provider)?.label} key? This falls back to the server's env var, if one is set.`,
      confirmLabel: 'Remove Key',
      danger: true,
    });
    if (!ok) return;

    setIsRemovingKey(true);
    setKeyError(null);
    try {
      await fetch(`/api/settings/keys/${settings.provider}`, { method: 'DELETE' });
      const res = await fetch('/api/settings');
      const data = await res.json();
      setConfigured(data.configured);
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setIsRemovingKey(false);
    }
  };

  if (isLoading) {
    return (
      <div className="minimal-card p-12 text-center">
        <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
      </div>
    );
  }

  if (!settings || !configured || !models) {
    return (
      <div className="bg-rose-50 border border-rose-200 p-4 text-rose-700 text-xs">
        <span className="font-bold">Couldn&apos;t load settings: </span>{error || 'Unknown error.'}
      </div>
    );
  }

  const activeProvider = PROVIDERS.find(p => p.id === settings.provider)!;
  const activeStatus = configured[settings.provider];

  return (
    <div className="space-y-8 font-sans pb-4 max-w-3xl">

      <div className="space-y-1.5">
        <h1 className="text-4xl sm:text-5xl font-display font-normal text-sand-50 tracking-tight">
          Settings
        </h1>
        <p className="text-sand-500 text-sm sm:text-base">
          Choose which AI provider and model run the codebase audit.
        </p>
      </div>

      <div className="minimal-card p-5 sm:p-6 space-y-6">

        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-sand-300 uppercase tracking-wider">Provider</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PROVIDERS.map((p) => {
              const active = settings.provider === p.id;
              const status = configured[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProvider(p.id)}
                  className={`flex items-center justify-between gap-2 p-3.5 border text-left transition-all cursor-pointer ${
                    active ? 'border-emerald-primary bg-emerald-light' : 'border-sand-700 hover:border-sand-500'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={`h-4 w-4 shrink-0 border flex items-center justify-center ${active ? 'border-emerald-primary bg-emerald-primary' : 'border-sand-600'}`}>
                      {active && <Check className="h-3 w-3 text-sand-950" />}
                    </span>
                    <span className="font-bold text-sand-50 truncate">{p.label}</span>
                  </span>
                  {status.source === 'user' ? (
                    <span className="text-[10px] font-bold text-sand-500 shrink-0">Your key</span>
                  ) : status.source === 'env' ? (
                    <span className="text-[10px] font-bold text-sand-500 shrink-0">Server default</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 shrink-0">
                      <AlertTriangle className="h-3 w-3" /> No key
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-1 border-t border-sand-800">
          <label className="flex items-center gap-1.5 text-xs font-bold text-sand-300 uppercase tracking-wider pt-4">
            <KeyRound className="h-3.5 w-3.5" /> {activeProvider.label} API Key
          </label>

          {activeStatus.source === 'user' ? (
            <div className="flex items-center justify-between gap-3 p-3 border border-dashed border-sand-700 bg-sand-950">
              <span className="font-mono text-sand-300 text-xs">{activeStatus.preview}</span>
              <button
                onClick={handleRemoveKey}
                disabled={isRemovingKey}
                className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 hover:text-rose-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemovingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Remove
              </button>
            </div>
          ) : (
            <>
              {activeStatus.source === 'env' && (
                <p className="text-[11px] text-sand-500">
                  Currently falling back to the server&apos;s <span className="font-mono">{activeProvider.envKey}</span>. Add your own key below to use it instead.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={`Paste your ${activeProvider.label} API key`}
                    className="w-full px-3.5 py-2.5 pr-10 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-500 hover:text-sand-200 cursor-pointer"
                    title={showApiKey ? 'Hide key' : 'Show key'}
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button
                  onClick={handleSaveKey}
                  disabled={isSavingKey || !apiKeyInput.trim()}
                  className="px-4 py-2.5 bg-sand-800 hover:bg-sand-700 text-sand-50 font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={apiKeyInput.trim() ? undefined : 'Paste a key first'}
                >
                  {isSavingKey && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSavingKey ? 'Saving...' : 'Save Key'}
                </button>
              </div>
            </>
          )}

          {keyError && (
            <div className="bg-rose-50 border border-rose-200 p-3 text-rose-700 text-xs">{keyError}</div>
          )}
          {keyJustSaved && (
            <span className="text-xs font-bold text-sand-300 flex items-center gap-1.5 animate-in fade-in">
              <Check className="h-3.5 w-3.5 text-emerald-primary" /> Key saved
            </span>
          )}
        </div>

        <div className="space-y-2.5 pt-1 border-t border-sand-800">
          <label className="block text-xs font-bold text-sand-300 uppercase tracking-wider pt-4">Model</label>
          <select
            value={useCustomModel ? CUSTOM_MODEL_VALUE : settings.model}
            onChange={(e) => selectModel(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
          >
            {models[settings.provider].map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
            <option value={CUSTOM_MODEL_VALUE}>Custom model ID...</option>
          </select>

          {useCustomModel && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => handleCustomModelChange(e.target.value)}
              placeholder="e.g. gemini-2.5-flash-002"
              className="w-full px-3.5 py-2.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary"
            />
          )}
        </div>

        {settings.provider === 'anthropic' && (
          <div className="space-y-2.5 pt-1 border-t border-sand-800">
            <label className="flex items-center gap-1.5 text-xs font-bold text-sand-300 uppercase tracking-wider pt-4">
              <Gauge className="h-3.5 w-3.5" /> Reasoning Effort
            </label>
            <select
              value={settings.effort || ''}
              onChange={(e) => setSettings({ ...settings, effort: (e.target.value || undefined) as AgentSettings['effort'] })}
              className="w-full px-3.5 py-2.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            >
              <option value="">Default (high)</option>
              {ANTHROPIC_EFFORT_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <p className="text-[11px] text-sand-500">
              Higher effort makes more tool calls and reasons more before submitting — usually more accurate on complex repos, at higher token cost. Claude-only; other providers ignore this.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 p-3 text-rose-700 text-xs">{error}</div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving || !settings.model.trim()}
            className="btn-emerald-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          {justSaved && (
            <span className="text-xs font-bold text-sand-300 flex items-center gap-1.5 animate-in fade-in">
              <Check className="h-3.5 w-3.5 text-emerald-primary" /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 text-xs text-sand-500">
        <Bot className="h-4 w-4 shrink-0 mt-0.5 text-sand-600" />
        <p>Keys you save here are encrypted before they&apos;re stored and never shown again in full — only a masked preview. Server env vars ({PROVIDERS.map(p => p.envKey).join(', ')}) are just the fallback when no key is saved for a provider.</p>
      </div>

      <div className="space-y-2.5">
        <label className="flex items-center gap-1.5 text-xs font-bold text-sand-300 uppercase tracking-wider">
          <Activity className="h-3.5 w-3.5" /> Recent Audits
        </label>
        {auditRuns === null ? (
          <div className="minimal-card p-6 text-center">
            <Loader2 className="h-4 w-4 mx-auto text-sand-500 animate-spin" />
          </div>
        ) : auditRuns.length === 0 ? (
          <div className="minimal-card p-6 text-center text-xs text-sand-500">
            No audits recorded yet — token usage and timing for each run will show up here.
          </div>
        ) : (
          <div className="minimal-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-sand-925 border-b border-sand-700 text-sand-400 font-semibold uppercase tracking-wide">
                    <th className="py-2.5 px-3">Repo</th>
                    <th className="py-2.5 px-3">Provider / Model</th>
                    <th className="py-2.5 px-3 text-right">Tool Calls</th>
                    <th className="py-2.5 px-3 text-right">Tokens (cached)</th>
                    <th className="py-2.5 px-3 text-right">Duration</th>
                    <th className="py-2.5 px-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-800">
                  {auditRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2.5 px-3 max-w-40 truncate font-mono text-sand-300" title={run.repoUrl}>
                        {run.repoUrl.replace('https://github.com/', '')}
                      </td>
                      <td className="py-2.5 px-3 text-sand-300">{run.provider} / {run.model}</td>
                      <td className="py-2.5 px-3 text-right text-sand-300">{run.toolCallCount ?? '—'}</td>
                      <td className="py-2.5 px-3 text-right text-sand-300">
                        {run.totalTokens != null ? (
                          <>{run.totalTokens.toLocaleString()}{run.cachedInputTokens ? <span className="text-sand-500"> ({run.cachedInputTokens.toLocaleString()})</span> : null}</>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sand-300">{(run.durationMs / 1000).toFixed(1)}s</td>
                      <td className="py-2.5 px-3">
                        {run.usedAgenticAnalysis ? (
                          <span className="text-emerald-primary font-bold">Agent</span>
                        ) : (
                          <span className="text-amber-700 font-bold" title={run.errorMessage || undefined}>Fallback</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

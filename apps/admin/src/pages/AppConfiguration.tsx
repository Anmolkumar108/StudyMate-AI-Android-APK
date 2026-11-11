import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Cpu,
  Zap,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const AppConfiguration: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local state for dynamic editing
  const [minVersion, setMinVersion] = useState<string>('1.0.0');
  const [forceUpdate, setForceUpdate] = useState<boolean>(false);
  const [storeUrl, setStoreUrl] = useState<string>('');

  const [featureFlags, setFeatureFlags] = useState<{
    ai_chat_enabled: boolean;
    pomodoro_timer_enabled: boolean;
    curated_curriculum_enabled: boolean;
    quiz_generator_enabled: boolean;
    gdpr_export_enabled: boolean;
  }>({
    ai_chat_enabled: true,
    pomodoro_timer_enabled: true,
    curated_curriculum_enabled: true,
    quiz_generator_enabled: true,
    gdpr_export_enabled: true,
  });

  const [aiLimits, setAiLimits] = useState<{
    daily_free_tier_queries: number;
    daily_pro_tier_queries: number;
    max_tokens_per_request: number;
    temperature: number;
  }>({
    daily_free_tier_queries: 50,
    daily_pro_tier_queries: 500,
    max_tokens_per_request: 4096,
    temperature: 0.7,
  });

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getAppConfigs();

      for (const item of res.items) {
        if (item.key === 'min_app_version' && item.value) {
          setMinVersion(item.value.version || '1.0.0');
          setForceUpdate(Boolean(item.value.force_update));
          setStoreUrl(item.value.store_url || '');
        } else if (item.key === 'feature_flags' && item.value) {
          setFeatureFlags({
            ai_chat_enabled: item.value.ai_chat_enabled ?? true,
            pomodoro_timer_enabled: item.value.pomodoro_timer_enabled ?? true,
            curated_curriculum_enabled: item.value.curated_curriculum_enabled ?? true,
            quiz_generator_enabled: item.value.quiz_generator_enabled ?? true,
            gdpr_export_enabled: item.value.gdpr_export_enabled ?? true,
          });
        } else if (item.key === 'ai_limits_config' && item.value) {
          setAiLimits({
            daily_free_tier_queries: item.value.daily_free_tier_queries ?? 50,
            daily_pro_tier_queries: item.value.daily_pro_tier_queries ?? 500,
            max_tokens_per_request: item.value.max_tokens_per_request ?? 4096,
            temperature: item.value.temperature ?? 0.7,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch application configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const saveConfig = async (key: string, value: any, description?: string) => {
    try {
      setSavingKey(key);
      setError(null);
      await apiClient.updateAppConfig(key, value, description);
      setSuccessMessage(`Configuration '${key}' updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchConfigs();
    } catch (err: any) {
      setError(err.message || `Failed to update ${key}`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveVersions = () => {
    saveConfig(
      'min_app_version',
      {
        version: minVersion,
        force_update: forceUpdate,
        store_url: storeUrl,
      },
      'Minimum required mobile application version and force-update gatekeeper.'
    );
  };

  const handleSaveFeatureFlags = () => {
    saveConfig(
      'feature_flags',
      featureFlags,
      'Remote feature flags to toggle student functionality dynamically without app store updates.'
    );
  };

  const handleSaveAiLimits = () => {
    saveConfig(
      'ai_limits_config',
      aiLimits,
      'Per-user AI query limits and generation hyperparameter constraints.'
    );
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Remote App & Feature Configuration</h1>
            <p className="text-xs text-slate-400">
              Control mobile app features, version constraints, and AI limits without publishing an app update
            </p>
          </div>
        </div>
        <button
          onClick={fetchConfigs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Main Container */}
      <div className="p-6 space-y-6 flex-1">
        {/* Toast Alerts */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Section 1: Mobile App Version Gating */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">App Version Enforcement</h3>
                <p className="text-xs text-slate-400">
                  Gate older Android client releases and prompt students to update via Google Play
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveVersions}
              disabled={savingKey === 'min_app_version'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingKey === 'min_app_version' ? 'Saving...' : 'Save Version Settings'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Minimum Supported Version
              </label>
              <input
                type="text"
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                SemVer format (e.g. 1.0.0, 1.2.0)
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Google Play Store URL
              </label>
              <input
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://play.google.com/store/apps/details?id=..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Target landing page when update required
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Force Immediate Update
              </label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForceUpdate(!forceUpdate)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    forceUpdate ? 'bg-amber-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      forceUpdate ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-slate-300">
                  {forceUpdate ? 'Enforced (Blocks App Until Updated)' : 'Optional Notification'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Remote Dynamic Feature Flags */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Dynamic Feature Flags (Killswitch & Rollout)</h3>
                <p className="text-xs text-slate-400">
                  Remotely disable student modules during high-load periods or incidents
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveFeatureFlags}
              disabled={savingKey === 'feature_flags'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingKey === 'feature_flags' ? 'Saving...' : 'Save Feature Flags'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {/* AI Assistant Chat */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">AI Study Assistant</span>
                <span className="text-[10px] text-slate-400">Chat & document questioning</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFeatureFlags({ ...featureFlags, ai_chat_enabled: !featureFlags.ai_chat_enabled })
                }
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  featureFlags.ai_chat_enabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    featureFlags.ai_chat_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Pomodoro Timer */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Pomodoro Timer</span>
                <span className="text-[10px] text-slate-400">Focus tracker and soundscapes</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFeatureFlags({
                    ...featureFlags,
                    pomodoro_timer_enabled: !featureFlags.pomodoro_timer_enabled,
                  })
                }
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  featureFlags.pomodoro_timer_enabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    featureFlags.pomodoro_timer_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Curated Curriculum */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Curated Templates</span>
                <span className="text-[10px] text-slate-400">Pre-built university syllabi</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFeatureFlags({
                    ...featureFlags,
                    curated_curriculum_enabled: !featureFlags.curated_curriculum_enabled,
                  })
                }
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  featureFlags.curated_curriculum_enabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    featureFlags.curated_curriculum_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* AI Quiz Generator */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">AI Quiz Generator</span>
                <span className="text-[10px] text-slate-400">Exam generation from notes</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFeatureFlags({
                    ...featureFlags,
                    quiz_generator_enabled: !featureFlags.quiz_generator_enabled,
                  })
                }
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  featureFlags.quiz_generator_enabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    featureFlags.quiz_generator_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* GDPR Data Portability */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Student GDPR Export</span>
                <span className="text-[10px] text-slate-400">Zip export of academic history</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFeatureFlags({
                    ...featureFlags,
                    gdpr_export_enabled: !featureFlags.gdpr_export_enabled,
                  })
                }
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  featureFlags.gdpr_export_enabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    featureFlags.gdpr_export_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: AI Quotas & Global Limits */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">AI Quotas & Hyperparameters</h3>
                <p className="text-xs text-slate-400">
                  Configure student daily query allowances and model response constraints
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveAiLimits}
              disabled={savingKey === 'ai_limits_config'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingKey === 'ai_limits_config' ? 'Saving...' : 'Save AI Limits'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Free Daily Queries
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={aiLimits.daily_free_tier_queries}
                onChange={(e) =>
                  setAiLimits({ ...aiLimits, daily_free_tier_queries: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 50 requests/day</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Pro Daily Queries
              </label>
              <input
                type="number"
                min="0"
                max="5000"
                value={aiLimits.daily_pro_tier_queries}
                onChange={(e) =>
                  setAiLimits({ ...aiLimits, daily_pro_tier_queries: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 500 requests/day</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Max Output Tokens
              </label>
              <input
                type="number"
                min="512"
                max="8192"
                step="256"
                value={aiLimits.max_tokens_per_request}
                onChange={(e) =>
                  setAiLimits({ ...aiLimits, max_tokens_per_request: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Per LLM completion</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Sampling Temperature
              </label>
              <input
                type="number"
                min="0.0"
                max="1.0"
                step="0.05"
                value={aiLimits.temperature}
                onChange={(e) =>
                  setAiLimits({ ...aiLimits, temperature: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">0.0 (Deterministic) to 1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

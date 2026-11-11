import React, { useEffect, useState } from 'react';
import { Bot, Save, AlertCircle, CheckCircle, RefreshCw, Cpu, DollarSign } from 'lucide-react';
import { adminApi } from '../api/client';
import { AIMetrics } from '../types';

export const AIGovernance: React.FC = () => {
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [budgetLimit, setBudgetLimit] = useState<number>(10.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAIMetrics();
      setMetrics(data);
      setSelectedModel(data.active_model_name);
      setBudgetLimit(data.daily_budget_limit_usd);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) return;

    setSaving(true);
    try {
      const updated = await adminApi.updateAIConfig(selectedModel, budgetLimit);
      setMetrics(updated);
      showToast(
        `AI Gateway updated to ${updated.active_model_name} with $${updated.daily_budget_limit_usd}/day cap.`,
        'success'
      );
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const modelDescriptions: Record<string, { desc: string; badge: string }> = {
    'gemini-3.1-flash-lite': {
      desc: 'Google Next-Gen ultra-fast flash-lite model. Lowest latency, ideal for real-time mobile flashcards & study schedules.',
      badge: 'Recommended / Cost-Optimized',
    },
    'gemini-3.8-flash': {
      desc: 'High-intelligence, multimodal model for complex STEM topic breakdowns and deep PDF conceptual analysis.',
      badge: 'Balanced Speed & Reasoning',
    },
    'gemini-2.5-pro': {
      desc: 'Deep reasoning engine with 1M+ token context window. Best suited for entire textbook syllabus synthesis.',
      badge: 'Heavyweight Reasoning',
    },
    'gpt-4o-mini': {
      desc: 'OpenAI low-latency compact model with structured JSON outputs and reliable study planning prompts.',
      badge: 'OpenAI Fallback',
    },
    'claude-3-5-haiku': {
      desc: 'Anthropic ultra-fast model with natural educational tone and nuanced Cornell note summarization.',
      badge: 'Anthropic Alternative',
    },
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading AI gateway configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto relative">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950 border-rose-500/30 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">AI Model Governance & Costs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dynamically switch backend LLM providers, enforce token budgets, and control model burn rates
        </p>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Provider</span>
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white capitalize">
            {metrics?.primary_provider || 'Google Gemini'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Backend proxy enforced via /api/v1/ai/*</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Model</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xl font-bold text-indigo-300 font-mono">
            {metrics?.active_model_name}
          </p>
          <p className="text-xs text-slate-500 mt-1">Switched without client app rebuilding</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Daily Spending Cap</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">
            ${metrics?.daily_budget_limit_usd.toFixed(2)} / day
          </p>
          <p className="text-xs text-slate-500 mt-1">Hard budget cap to prevent cloud spikes</p>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-white mb-1">Select Active Model Architecture</h3>
          <p className="text-xs text-slate-400 mb-4">
            Changes take effect immediately across all student mobile requests (Explain, Chat, Cornell Notes, Quizzes).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {metrics?.available_models.map((model) => {
              const isSelected = selectedModel === model;
              const meta = modelDescriptions[model] || {
                desc: 'Configurable LLM provider model.',
                badge: 'General LLM',
              };
              return (
                <div
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-600/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold text-white">{model}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {meta.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{meta.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget Limit Slider */}
        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-white">Daily Hard Budget Limit ($ USD)</label>
            <span className="text-base font-mono font-bold text-emerald-400">
              ${Number(budgetLimit).toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Requests exceeding this daily limit will be throttled to prevent unintended API billing overages.
          </p>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-2">
            <span>$1.00 / day</span>
            <span>$50.00 / day</span>
            <span>$100.00 / day</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Applying Configuration...' : 'Save AI Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};


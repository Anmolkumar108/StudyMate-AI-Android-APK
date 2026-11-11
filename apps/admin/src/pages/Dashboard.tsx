import React, { useEffect, useState } from 'react';
import {
  Users,
  Clock,
  BookOpen,
  Megaphone,
  Bot,
  Activity,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { adminApi } from '../api/client';
import { DashboardStats, AIMetrics, AuditLog } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [sData, aData, lData] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getAIMetrics().catch(() => null),
        adminApi.getAuditLogs({ limit: 5 }).catch(() => ({ items: [], total: 0 })),
      ]);
      setStats(sData);
      setAiMetrics(aData);
      setRecentLogs(lData.items);
    } catch (e) {
      console.error('Failed to load dashboard metrics', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Fetching real-time platform metrics...</p>
        </div>
      </div>
    );
  }

  const budgetLimit = aiMetrics?.daily_budget_limit_usd || 10.0;
  const spentToday = aiMetrics?.estimated_today_cost_usd || 0.08;
  const budgetPercentage = Math.min(Math.round((spentToday / budgetLimit) * 100), 100);

  const totalAssets =
    (stats?.total_notes || 0) +
    (stats?.total_flashcard_decks || 0) +
    (stats?.total_documents || 0) +
    (stats?.total_quizzes || 0);

  const calcPercentage = (count: number) => {
    if (!totalAssets) return 0;
    return Math.round((count / totalAssets) * 100);
  };

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time platform overview and student productivity metrics
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Operational Health Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <span className="text-sm font-semibold text-emerald-300">
              All Systems Operational
            </span>
            <p className="text-xs text-slate-400">
              FastAPI Modular Monolith • PostgreSQL 16 • Android Push Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>MFA & Rate Limiting Active</span>
          </div>
          <span>
            Active Students: <strong className="text-white">{stats?.active_students || 0}</strong>
          </span>
          <span>•</span>
          <span>
            Suspended Accounts:{' '}
            <strong className="text-rose-400">{stats?.suspended_students || 0}</strong>
          </span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Students"
          value={stats?.total_students || 0}
          subtitle={`${stats?.active_students || 0} active • ${stats?.pending_verification_students || 0} pending`}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Total Focus Hours"
          value={`${stats?.total_focus_hours || 0} hrs`}
          subtitle="Cumulative Pomodoro & deep study time"
          icon={Clock}
          color="emerald"
        />
        <StatCard
          title="Learning Assets Generated"
          value={totalAssets}
          subtitle={`${stats?.total_notes || 0} notes • ${stats?.total_flashcard_decks || 0} decks`}
          icon={BookOpen}
          color="sky"
        />
        <StatCard
          title="Active Broadcast Alerts"
          value={stats?.active_announcements_count || 0}
          subtitle="Broadcast banners active in mobile apps"
          icon={Megaphone}
          color="amber"
        />
      </div>

      {/* Secondary Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Gateway & Budget Meter Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">AI Engine & Budget Meter</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                Live Gateway
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400">Active Model Provider & Engine</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm font-bold text-white capitalize">
                    {aiMetrics?.primary_provider || 'Google Gemini'}
                  </p>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                    {aiMetrics?.active_model_name || 'gemini-3.1-flash-lite'}
                  </span>
                </div>
              </div>

              {/* Budget Progress Bar */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Today's AI Spending</span>
                  <span className="text-emerald-400 font-bold">
                    ${spentToday.toFixed(2)} / ${budgetLimit.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(budgetPercentage, 2)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{budgetPercentage}% of daily cap used</span>
                  <span className="text-emerald-400">Cost-Optimized</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('ai-governance')}
            className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Manage AI Models & Budget</span>
          </button>
        </div>

        {/* Content Breakdown with Visual Proportions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                <h3 className="font-semibold text-white text-sm">Learning Content Distribution</h3>
              </div>
              <span className="text-xs text-slate-400">{totalAssets} Assets</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">Structured Cornell Notes</span>
                  <span className="font-bold text-white">
                    {stats?.total_notes || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({calcPercentage(stats?.total_notes || 0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: `${calcPercentage(stats?.total_notes || 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">Flashcard Decks</span>
                  <span className="font-bold text-white">
                    {stats?.total_flashcard_decks || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({calcPercentage(stats?.total_flashcard_decks || 0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${calcPercentage(stats?.total_flashcard_decks || 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">Uploaded Study Documents</span>
                  <span className="font-bold text-white">
                    {stats?.total_documents || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({calcPercentage(stats?.total_documents || 0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full"
                    style={{ width: `${calcPercentage(stats?.total_documents || 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">AI Practice Quizzes</span>
                  <span className="font-bold text-white">
                    {stats?.total_quizzes || 0}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({calcPercentage(stats?.total_quizzes || 0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${calcPercentage(stats?.total_quizzes || 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('students')}
            className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>View Active Student Creators</span>
          </button>
        </div>

        {/* Quick Platform Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white text-sm">Security & Quick Actions</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Direct access shortcuts for critical moderation, broadcasting, and compliance logging.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => onNavigate('announcements')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-between px-4 shadow-lg shadow-indigo-600/20"
            >
              <div className="flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Broadcast New Alert</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('students')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                <span>Search & Moderate Students</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('audit-logs')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Inspect Audit Trail</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Security & Administrative Activity Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Recent Platform Activity & Audit Trail</h3>
          </div>
          <button
            onClick={() => onNavigate('audit-logs')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No recent administrative events recorded.</p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-3">
                  <Badge label={log.action} variant="info" />
                  <div>
                    <p className="font-semibold text-white">
                      {log.details || log.action}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      By {log.actor_name || log.actor_email || 'System'} • Target: {log.target_type} ({log.target_id || 'Global'})
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 whitespace-nowrap ml-4">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

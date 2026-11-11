import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Download,
  HardDrive,
  LogOut,
  Power,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { adminApi } from '../api/client';
import { SystemHealthAnalyticsResponse } from '../types';

export const SystemHealth: React.FC = () => {
  const [analytics, setAnalytics] = useState<SystemHealthAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Action States
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [showKillswitchModal, setShowKillswitchModal] = useState(false);
  const [killswitchScope, setKillswitchScope] = useState<'students' | 'all'>('students');
  const [killswitchLoading, setKillswitchLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await adminApi.getSystemAnalytics();
      setAnalytics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve system health telemetry';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleMaintenance = async () => {
    if (!analytics) return;
    setActionLoading(true);
    const targetState = !analytics.security.is_maintenance_mode;
    try {
      const res = await adminApi.toggleMaintenanceMode(targetState, maintenanceReason.trim() || undefined);
      setAnalytics({
        ...analytics,
        security: {
          ...analytics.security,
          is_maintenance_mode: res.is_maintenance_mode,
        },
      });
      showToast(res.message, 'success');
      setShowMaintenanceModal(false);
      setMaintenanceReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle maintenance mode';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceLogoutStudents = async () => {
    setKillswitchLoading(true);
    try {
      const res = await adminApi.forceLogoutStudents(killswitchScope);
      showToast(res.message, 'success');
      setShowKillswitchModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute student session killswitch';
      showToast(msg, 'error');
    } finally {
      setKillswitchLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await adminApi.triggerDatabaseBackup();
      const blob = new Blob([JSON.stringify(res.snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(res.message || `Database snapshot '${res.filename}' downloaded successfully.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database state snapshot failed';
      showToast(msg, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const maxDailyMinutes = Math.max(
    ...(analytics?.daily_focus_trends.map((t) => t.focus_minutes) || [100]),
    60
  );

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto relative">
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
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">System & Analytics</h1>
            {analytics?.security.is_maintenance_mode ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                <Power className="w-3.5 h-3.5" />
                Maintenance Mode Active
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Platform Operational
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time infrastructure telemetry, student engagement cohorts, and emergency operational controls
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-indigo-400" />
          Querying platform telemetry and database metrics...
        </div>
      ) : !analytics ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
          <h3 className="text-white font-bold text-base">Failed to load system telemetry</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Could not retrieve real-time infrastructure metrics. Check backend server connection or retry.
          </p>
          <button
            onClick={() => loadData(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Query</span>
          </button>
        </div>
      ) : analytics ? (
        <>
          {/* Cohorts & Engagement Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Daily Active (DAU)
                </span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white mt-3 tracking-tight">
                {analytics.dau.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Students active within last 24h</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Weekly Active (WAU)
                </span>
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white mt-3 tracking-tight">
                {analytics.wau.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Unique students across last 7 days</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Monthly Active (MAU)
                </span>
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white mt-3 tracking-tight">
                {analytics.mau.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Active platform students (30 days)</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Retention Rate
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-emerald-400 mt-3 tracking-tight">
                {analytics.retention_rate_pct}%
              </p>
              <p className="text-[11px] text-slate-500 mt-1">30-day student return ratio</p>
            </div>
          </div>

          {/* 7-Day Study Trends & Top Subjects */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 7-Day Focus Minutes Visualization */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">7-Day Study Focus & Session Volume</h2>
                    <p className="text-xs text-slate-400">Aggregated student Pomodoro study sessions</p>
                  </div>
                </div>
              </div>

              {analytics.daily_focus_trends.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No study sessions recorded across the platform yet.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-7 gap-2 items-end h-44 pb-2 border-b border-slate-800">
                    {analytics.daily_focus_trends.map((item) => {
                      const heightPercent = Math.max(
                        Math.round((item.focus_minutes / maxDailyMinutes) * 100),
                        6
                      );
                      const dateShort = item.date.slice(5); // e.g. "11-07"
                      return (
                        <div key={item.date} className="flex flex-col items-center gap-2 group relative">
                          {/* Tooltip */}
                          <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-950 border border-slate-800 rounded-lg p-2 text-center shadow-2xl z-10 whitespace-nowrap">
                            <p className="text-white font-bold text-xs">{item.focus_minutes} mins</p>
                            <p className="text-slate-400 text-[10px]">
                              {item.sessions_count} sessions · {item.unique_students} students
                            </p>
                          </div>

                          <div className="w-full flex items-end justify-center h-32">
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className="w-full max-w-[36px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-300 group-hover:from-indigo-500 group-hover:to-indigo-300"
                            />
                          </div>
                          <span className="text-[11px] font-medium text-slate-400">{dateShort}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                    <span>
                      Total Focus Time: <strong>{analytics.daily_focus_trends.reduce((acc, t) => acc + t.focus_minutes, 0)} mins</strong>
                    </span>
                    <span>
                      Total Sessions: <strong>{analytics.daily_focus_trends.reduce((acc, t) => acc + t.sessions_count, 0)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Top Subjects */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Top Subjects</h2>
                  <p className="text-xs text-slate-400">Most active student courses</p>
                </div>
              </div>

              {analytics.top_subjects.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No subjects enrolled across students yet.
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {analytics.top_subjects.map((subj, idx) => (
                    <div
                      key={subj.name}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-center text-xs font-mono font-bold text-slate-500">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">{subj.name}</p>
                          {subj.code && (
                            <span className="text-[10px] text-slate-400 font-mono">{subj.code}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-400">{subj.student_count}</span>
                        <span className="text-[11px] text-slate-500">students</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Infrastructure & Threat Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Database Telemetry */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">PostgreSQL Database</h2>
                    <p className="text-xs text-slate-400">{analytics.database.version}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {analytics.database.status}
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Ping Query Latency:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {analytics.database.latency_ms.toFixed(2)} ms
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Total Database Records:</span>
                  <span className="text-white font-mono font-bold">
                    {analytics.database.total_rows.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Connection Mode:</span>
                  <span className="text-indigo-400 font-mono font-medium">SQLAlchemy 2.0 Async (asyncpg)</span>
                </div>

                {analytics.database.table_counts && Object.keys(analytics.database.table_counts).length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Table Breakdown</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {Object.entries(analytics.database.table_counts).map(([tbl, count]) => (
                        <div key={tbl} className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 truncate pr-1">{tbl}</span>
                          <span className="text-white font-mono font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={handleTriggerBackup}
                    disabled={isBackingUp}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-bounce' : ''}`} />
                    <span>{isBackingUp ? 'Generating Snapshot...' : 'Trigger Instant DB Snapshot'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Storage Telemetry */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Document Storage</h2>
                  <p className="text-xs text-slate-400">{analytics.storage.storage_backend}</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Total Uploaded Files:</span>
                  <span className="text-white font-mono font-bold">
                    {analytics.storage.total_files.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Disk Footprint:</span>
                  <span className="text-sky-400 font-mono font-bold">
                    {analytics.storage.total_size_mb.toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">File Type Validation:</span>
                  <span className="text-emerald-400 font-mono font-medium">PDF Magic Bytes (%PDF-)</span>
                </div>
              </div>
            </div>

            {/* Security Telemetry */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Security & Audit Sentinel</h2>
                  <p className="text-xs text-slate-400">Zero-Trust & Rate Limiting</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Failed Logins (24h):</span>
                  <span
                    className={`font-mono font-bold ${
                      analytics.security.failed_logins_24h > 5 ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {analytics.security.failed_logins_24h}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Rate Limit Blocks (24h):</span>
                  <span
                    className={`font-mono font-bold ${
                      analytics.security.rate_limit_blocks_24h > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {analytics.security.rate_limit_blocks_24h}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Active Super Admins:</span>
                  <span className="text-indigo-400 font-mono font-bold">
                    {analytics.security.active_super_admins}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Operations & Killswitch Section */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Power className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Emergency Operational Safeguards</h2>
                <p className="text-xs text-slate-400">
                  High-privilege platform interventions restricted to Super Administrators
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Maintenance Mode Control */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">Platform Maintenance Mode</h3>
                    {analytics.security.is_maintenance_mode ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                        DISABLED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Temporarily broadcast a critical platform notice to all mobile clients and prepare for server upgrades.
                  </p>
                </div>
                <button
                  onClick={() => setShowMaintenanceModal(true)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
                    analytics.security.is_maintenance_mode
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>
                    {analytics.security.is_maintenance_mode
                      ? 'Deactivate Maintenance Mode'
                      : 'Activate Maintenance Mode'}
                  </span>
                </button>
              </div>

              {/* Force Logout Killswitch */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-rose-400">Student Session Killswitch</h3>
                    <span className="text-[10px] bg-rose-950/60 text-rose-400 border border-rose-900/40 px-2 py-0.5 rounded-full font-semibold">
                      CRITICAL ACTION
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Increment <code className="text-indigo-400">token_version</code> for all registered students, instantly invalidating every active mobile JWT session.
                  </p>
                </div>
                <button
                  onClick={() => setShowKillswitchModal(true)}
                  className="w-full py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Invalidate All Student Sessions</span>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Maintenance Mode Confirmation Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-white text-base">
                {analytics?.security.is_maintenance_mode
                  ? 'Deactivate Maintenance Mode'
                  : 'Activate Maintenance Mode'}
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              {analytics?.security.is_maintenance_mode
                ? 'Deactivating maintenance mode will clear system-wide broadcast alerts and return all services to standard operation.'
                : 'Activating maintenance mode will broadcast a platform-wide notice to all student devices.'}
            </p>

            {!analytics?.security.is_maintenance_mode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reason for Maintenance Notice
                </label>
                <input
                  type="text"
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="e.g. Scheduled database optimization and security upgrades"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleMaintenance}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Updating Status...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Killswitch Confirmation Modal */}
      {showKillswitchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-white text-base">Emergency Session Revocation</h3>
            </div>
            <p className="text-xs text-slate-300">
              Select which accounts should have their active JWT sessions and refresh tokens immediately revoked:
            </p>

            {/* Scope Selection */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setKillswitchScope('students')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  killswitchScope === 'students'
                    ? 'bg-rose-950/60 border-rose-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <p className="text-xs font-bold text-white">Students Only</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Revoke all student mobile app logins</p>
              </button>
              <button
                type="button"
                onClick={() => setKillswitchScope('all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  killswitchScope === 'all'
                    ? 'bg-rose-950/60 border-rose-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <p className="text-xs font-bold text-rose-300">All Platform Users</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Emergency reset for students and staff</p>
              </button>
            </div>

            <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-xl text-[11px] text-rose-300 space-y-1">
              <p className="font-bold">⚠️ Security Impact:</p>
              <p>
                Both JWT access tokens and database refresh sessions will be destroyed. Affected devices will be immediately signed out upon next network request and cannot auto-refresh.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKillswitchModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleForceLogoutStudents}
                disabled={killswitchLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {killswitchLoading
                  ? 'Revoking Sessions...'
                  : killswitchScope === 'all'
                  ? 'Revoke All Platform Sessions'
                  : 'Revoke All Student Sessions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

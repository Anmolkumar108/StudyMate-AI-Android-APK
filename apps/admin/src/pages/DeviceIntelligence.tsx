import React, { useEffect, useState, useMemo } from 'react';
import {
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  LogIn,
  AlertTriangle,
  RefreshCw,
  Search,
  Radio,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
  Clock,
  Info,
} from 'lucide-react';
import { adminApi } from '../api/client';
import {
  LiveTelemetryFeedResponse,
  UserSessionDetail,
} from '../types';
import { StatCard } from '../components/StatCard';

export const DeviceIntelligence: React.FC = () => {
  const [feedData, setFeedData] = useState<LiveTelemetryFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Modal states
  const [selectedUserForSessions, setSelectedUserForSessions] = useState<{
    id: string;
    email: string;
    name?: string;
  } | null>(null);
  const [userSessions, setUserSessions] = useState<UserSessionDetail[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  // Password reset trigger state
  const [resetPromptUser, setResetPromptUser] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [triggeringReset, setTriggeringReset] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Copied IP helper
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const loadFeed = async (showLoading = true) => {
    if (showLoading) setRefreshing(true);
    try {
      const data = await adminApi.getTelemetryFeed(100);
      setFeedData(data);
    } catch (e) {
      console.error('Failed to load telemetry feed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed(true);
  }, []);

  // 10s auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadFeed(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleCopyIp = (ip: string) => {
    navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleOpenSessions = async (userId: string, email: string, name?: string) => {
    setSelectedUserForSessions({ id: userId, email, name });
    setLoadingSessions(true);
    try {
      const targetQuery = email.trim() || userId;
      const sessions = await adminApi.getUserSessions(targetQuery);
      setUserSessions(sessions);
    } catch (e) {
      console.error('Failed to load user sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await adminApi.revokeUserSession(sessionId);
      setUserSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_revoked: true } : s))
      );
    } catch (e) {
      console.error('Failed to revoke session', e);
      alert('Failed to revoke device session.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!resetPromptUser) return;
    setTriggeringReset(true);
    setResetSuccessMessage(null);
    try {
      const targetQuery = resetPromptUser.email.trim() || resetPromptUser.id;
      const res = await adminApi.triggerPasswordReset(targetQuery);
      setResetSuccessMessage(res.message);
      setTimeout(() => {
        setResetPromptUser(null);
        setResetSuccessMessage(null);
      }, 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to trigger password reset.');
    } finally {
      setTriggeringReset(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!feedData) return [];
    return feedData.events.filter((ev) => {
      // Type filter
      if (selectedFilter !== 'all' && ev.event_type !== selectedFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const emailMatch = ev.actor_email?.toLowerCase().includes(q);
        const nameMatch = ev.actor_name?.toLowerCase().includes(q);
        const ipMatch = ev.ip_address?.toLowerCase().includes(q);
        const devMatch = ev.device_name?.toLowerCase().includes(q);
        const detailsMatch = ev.details?.toLowerCase().includes(q);
        return emailMatch || nameMatch || ipMatch || devMatch || detailsMatch;
      }
      return true;
    });
  }, [feedData, selectedFilter, searchQuery]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'signup':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <UserPlus className="w-3 h-3" /> New Student
          </span>
        );
      case 'login_success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <LogIn className="w-3 h-3" /> Login OK
          </span>
        );
      case 'login_failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> Login Failed
          </span>
        );
      case 'app_opened':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Smartphone className="w-3 h-3" /> App Opened
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Info className="w-3 h-3" /> Security Event
          </span>
        );
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    const diffSeconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diffSeconds < 10) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoDate).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full min-h-full p-6 md:p-8 space-y-6 bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 sticky top-0 bg-slate-950/90 backdrop-blur-md z-10 pt-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Device Radar & Security Telemetry
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Radar
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Real-time forensic telemetry on device models, app opens, student logins, IP addresses, and brute-force sentinels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-2 ${
              autoRefresh
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-indigo-400 animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-Sync: ON (10s)' : 'Auto-Sync: OFF'}
          </button>

          <button
            onClick={() => loadFeed(true)}
            disabled={refreshing}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Devices (24h)"
          value={feedData?.active_devices_24h ?? 0}
          subtitle="Distinct mobile hardware & sessions"
          icon={Smartphone}
          color="sky"
        />
        <StatCard
          title="New Student Signups (24h)"
          value={feedData?.new_signups_24h ?? 0}
          subtitle="Registered student accounts"
          icon={UserPlus}
          color="emerald"
        />
        <StatCard
          title="Failed Login Attempts (24h)"
          value={feedData?.failed_logins_24h ?? 0}
          subtitle={
            (feedData?.failed_logins_24h ?? 0) > 0
              ? 'Potential credential rejections'
              : 'Zero failed attempts'
          }
          icon={ShieldAlert}
          color={(feedData?.failed_logins_24h ?? 0) > 0 ? 'rose' : 'indigo'}
        />
        <StatCard
          title="Brute-Force Sentinel"
          value={
            (feedData?.brute_force_threats.length ?? 0) > 0
              ? `${feedData?.brute_force_threats.length} Threat Alerts`
              : 'Normal (Clean)'
          }
          subtitle={
            (feedData?.brute_force_threats.length ?? 0) > 0
              ? '≥ 3 failed attempts on IP/email'
              : 'Zero anomalous login spikes'
          }
          icon={(feedData?.brute_force_threats.length ?? 0) > 0 ? AlertTriangle : ShieldCheck}
          color={(feedData?.brute_force_threats.length ?? 0) > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Brute-Force Alert Sentinel Banner */}
      {feedData && feedData.brute_force_threats.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 md:p-5 shadow-lg shadow-rose-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-rose-200">
                  Brute-Force Sentinel Active: {feedData.brute_force_threats.length} High-Risk Patterns Detected
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 uppercase">
                  Action Recommended
                </span>
              </div>
              <p className="text-xs text-rose-300/80 mt-1">
                The security engine identified automated or repeated password retry attempts exceeding threshold.
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {feedData.brute_force_threats.map((threat, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/80 border border-rose-900/60 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-rose-300">
                        {threat.target_email || 'Unknown User'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        IP: {threat.ip_address || 'Unknown IP'}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-rose-500/20 text-rose-400 font-bold text-xs rounded">
                      {threat.failed_attempts} fails
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Telemetry' },
            { id: 'signup', label: 'Signups' },
            { id: 'login_success', label: 'Successful Logins' },
            { id: 'login_failed', label: 'Failed Logins' },
            { id: 'app_opened', label: 'App Launches' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search email, IP, device model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Live Event Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Live Event Stream</h2>
            <span className="text-xs text-slate-500">
              ({filteredEvents.length} events logged)
            </span>
          </div>
          {feedData?.events[0] && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              Latest: {formatRelativeTime(feedData.events[0].timestamp)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Streaming live telemetry logs...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No telemetry logs match the current filter or search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Student / Identity</th>
                  <th className="py-3 px-4">Device Model</th>
                  <th className="py-3 px-4">OS & Client</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 text-right">Forensic Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Event Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getEventBadge(ev.event_type)}
                    </td>

                    {/* Student / Target Identity */}
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-white">
                          {ev.actor_email || ev.actor_name || 'Anonymous Client'}
                        </p>
                        {ev.actor_name && ev.actor_email && (
                          <p className="text-[10px] text-slate-400">{ev.actor_name}</p>
                        )}
                        {ev.details && (
                          <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                            {ev.details}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Device Model */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-medium text-slate-200">
                          {ev.device_name || 'Android Device'}
                        </span>
                      </div>
                    </td>

                    {/* OS & Client */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {ev.device_os || 'Android'}
                      </span>
                    </td>

                    {/* IP Address */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-300">
                          {ev.ip_address || '127.0.0.1'}
                        </span>
                        {ev.ip_address && (
                          <button
                            onClick={() => handleCopyIp(ev.ip_address!)}
                            title="Copy IP address"
                            className="p-1 rounded text-slate-500 hover:text-slate-200 transition-colors"
                          >
                            {copiedIp === ev.ip_address ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <div>
                        <p className="font-medium text-slate-300">
                          {formatRelativeTime(ev.timestamp)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap text-right min-w-[210px]">
                      <div className="flex items-center justify-end gap-2">
                        {/* If event has an actor_id or registered email, allow device inspection */}
                        {ev.actor_email && (
                          <>
                            <button
                              onClick={() => {
                                handleOpenSessions(
                                  ev.actor_id || ev.id,
                                  ev.actor_email!,
                                  ev.actor_name || undefined
                                );
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/30 rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Devices</span>
                            </button>

                            <button
                              onClick={() =>
                                setResetPromptUser({
                                  id: ev.actor_id || ev.id,
                                  email: ev.actor_email!,
                                })
                              }
                              title="Trigger secure password reset for this student"
                              className="px-2.5 py-1 text-xs font-semibold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-600 border border-amber-500/30 rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset PW</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Device Sessions Modal */}
      {selectedUserForSessions && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">
                  Active Devices & Remote Session Kill
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Student: <span className="text-indigo-400">{selectedUserForSessions.email}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedUserForSessions(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {loadingSessions ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Loading active student device sessions...
                </div>
              ) : userSessions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No active session tokens found for this student.
                </div>
              ) : (
                <div className="space-y-3">
                  {userSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-indigo-400" />
                          <span className="font-semibold text-white text-xs">
                            {session.device_name || 'Android Device'}
                          </span>
                          {session.is_revoked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          OS: {session.device_os || 'Android'} | IP: {session.ip_address || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Logged in: {new Date(session.created_at).toLocaleString()}
                        </p>
                      </div>

                      {!session.is_revoked && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revokingSessionId === session.id}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-lg transition-all disabled:opacity-50"
                        >
                          {revokingSessionId === session.id ? 'Revoking...' : 'Disconnect'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const studentEmail = selectedUserForSessions.email;
                  setSelectedUserForSessions(null);
                  setResetPromptUser({
                    id: studentEmail,
                    email: studentEmail,
                  });
                }}
                className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30 flex items-center gap-1.5 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Send Password Reset Link</span>
              </button>

              <button
                onClick={() => setSelectedUserForSessions(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Trigger Confirmation Modal */}
      {resetPromptUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Trigger Secure Password Reset?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Dispatches a secure, single-use password reset email and OTP to:
                </p>
                <p className="text-xs font-semibold text-indigo-400 font-mono mt-1">
                  {resetPromptUser.email}
                </p>
              </div>

              {resetSuccessMessage ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {resetSuccessMessage}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  🛡️ Argon2id Zero-Knowledge: Passwords are never revealed in plaintext. This action allows the verified student to set a new password safely.
                </p>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setResetPromptUser(null)}
                  disabled={triggeringReset}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPasswordReset}
                  disabled={triggeringReset || Boolean(resetSuccessMessage)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {triggeringReset ? 'Dispatching...' : 'Dispatch Reset Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceIntelligence;

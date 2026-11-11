import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Bell,
  X,
  Power,
  Clock,
  Filter,
} from 'lucide-react';
import { adminApi } from '../api/client';
import { Announcement } from '../types';
import { Badge } from '../components/Badge';

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [targetAudience, setTargetAudience] = useState<'all' | 'students'>('all');
  const [expiryOption, setExpiryOption] = useState<'none' | '24h' | '3d' | '7d'>('none');
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAnnouncements();
      setAnnouncements(res.items);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast('Please fill in both title and message.', 'error');
      return;
    }
    if (title.trim().length < 3) {
      showToast('Title must be at least 3 characters.', 'error');
      return;
    }
    if (message.trim().length < 5) {
      showToast('Message must be at least 5 characters.', 'error');
      return;
    }

    let expiresAt: string | null = null;
    if (expiryOption !== 'none') {
      const d = new Date();
      if (expiryOption === '24h') d.setHours(d.getHours() + 24);
      else if (expiryOption === '3d') d.setDate(d.getDate() + 3);
      else if (expiryOption === '7d') d.setDate(d.getDate() + 7);
      expiresAt = d.toISOString();
    }

    setSubmitting(true);
    try {
      const created = await adminApi.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        severity,
        target_audience: targetAudience,
        expires_at: expiresAt,
      });
      setAnnouncements([created, ...announcements]);
      setModalOpen(false);
      setTitle('');
      setMessage('');
      setExpiryOption('none');
      showToast('Announcement broadcasted to mobile users successfully.', 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    try {
      const updated = await adminApi.toggleAnnouncement(id);
      setAnnouncements(announcements.map((a) => (a.id === updated.id ? updated : a)));
      showToast(
        `Announcement ${updated.is_active ? 'activated' : 'paused'} successfully.`,
        'success'
      );
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminApi.deleteAnnouncement(id);
      setAnnouncements(announcements.filter((a) => a.id !== id));
      showToast('Announcement removed from mobile apps.', 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (statusFilter === 'active') return a.is_active;
    if (statusFilter === 'paused') return !a.is_active;
    return true;
  });

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Mobile Broadcast Announcements
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Publish system-wide notifications, exam focus alerts, and maintenance banners to Android clients
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAnnouncements}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Broadcast Alert</span>
          </button>
        </div>
      </div>

      {/* Filter and Summary Bar */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 px-4 py-2.5 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Filter by Status:</span>
          {(['all', 'active', 'paused'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 rounded-lg text-xs capitalize font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="text-slate-400 text-xs">
          Showing <strong>{filteredAnnouncements.length}</strong> of{' '}
          <strong>{announcements.length}</strong> announcements
        </div>
      </div>

      {/* Announcements Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Title & Message</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Audience</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Broadcast Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading announcements...
                  </td>
                </tr>
              ) : filteredAnnouncements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No broadcast announcements found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredAnnouncements.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="font-semibold text-white">{a.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{a.message}</p>
                      {a.expires_at && (
                        <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Expires: {new Date(a.expires_at).toLocaleString()}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        label={a.severity}
                        variant={
                          a.severity === 'critical'
                            ? 'danger'
                            : a.severity === 'warning'
                            ? 'warning'
                            : 'info'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-300">{a.target_audience}</td>
                    <td className="py-3.5 px-4">
                      <Badge
                        label={a.is_active ? 'Active' : 'Paused'}
                        variant={a.is_active ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggle(a.id)}
                          disabled={togglingId === a.id}
                          title={a.is_active ? 'Pause Announcement' : 'Activate Announcement'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            a.is_active
                              ? 'text-emerald-400 hover:bg-emerald-950/40'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          title="Delete Announcement"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Creation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">New System Broadcast</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled Maintenance Sunday 2:00 AM"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Severity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['info', 'warning', 'critical'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSeverity(lvl)}
                      className={`py-2 text-xs font-semibold rounded-xl border capitalize transition-all ${
                        severity === lvl
                          ? lvl === 'critical'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                            : lvl === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['all', 'students'] as const).map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setTargetAudience(aud)}
                      className={`py-2 text-xs font-semibold rounded-xl border capitalize transition-all ${
                        targetAudience === aud
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {aud === 'all' ? 'All Platform Users' : 'Students Only'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Expiration Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'none', label: 'Never' },
                    { id: '24h', label: '24 Hours' },
                    { id: '3d', label: '3 Days' },
                    { id: '7d', label: '7 Days' },
                  ].map((exp) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setExpiryOption(exp.id as any)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                        expiryOption === exp.id
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {exp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Message Content (Markdown Supported)
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write clear instructions for students in their mobile app feed..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Mobile Preview Box */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Mobile In-App Banner Preview
                </p>
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                      : severity === 'warning'
                      ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                      : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
                  }`}
                >
                  <p className="font-bold">{title || 'Preview Title'}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {message || 'Your announcement message will render here.'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Broadcast to App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

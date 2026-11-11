import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, Download, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { adminApi } from '../api/client';
import { AuditLog } from '../types';
import { Badge } from '../components/Badge';
import {
  exportToExcel,
  exportToCsv,
  formatDateTime,
  formatActionLabel,
  ExportColumn,
} from '../utils/exportUtils';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({
        action: actionFilter || undefined,
        limit: 100,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const exportAuditExcel = () => {
    if (logs.length === 0) {
      showToast('No audit logs to export.', 'error');
      return;
    }
    const columns: ExportColumn[] = [
      { header: 'Timestamp', key: 'timestamp', width: 145 },
      { header: 'Actor Name', key: 'actor_name', width: 160 },
      { header: 'Actor Email', key: 'actor_email', width: 220 },
      { header: 'Action', key: 'action', width: 190 },
      { header: 'Target Type', key: 'target_type', width: 110 },
      { header: 'Target ID', key: 'target_id', width: 130 },
      { header: 'Event Details & Narrative', key: 'details', width: 360 },
      { header: 'IP Address', key: 'ip_address', width: 110 },
    ];
    const rows = logs.map((l) => ({
      timestamp: formatDateTime(l.created_at),
      actor_name: l.actor_name || 'System / Automated',
      actor_email: l.actor_email || '—',
      action: formatActionLabel(l.action),
      target_type: l.target_type,
      target_id: l.target_id || '—',
      details: l.details || '',
      ip_address: l.ip_address || '—',
    }));
    exportToExcel({
      filename: `studymate_audit_trail_${new Date().toISOString().split('T')[0]}.xls`,
      sheetName: 'Audit Logs',
      columns,
      rows,
    });
    showToast('Audit trail exported to Excel (.xls) with custom columns & formatting.', 'success');
  };

  const exportAuditCsv = () => {
    if (logs.length === 0) {
      showToast('No audit logs to export.', 'error');
      return;
    }
    const columns: ExportColumn[] = [
      { header: 'Timestamp', key: 'timestamp' },
      { header: 'Actor Name', key: 'actor_name' },
      { header: 'Actor Email', key: 'actor_email' },
      { header: 'Action', key: 'action' },
      { header: 'Target Type', key: 'target_type' },
      { header: 'Target ID', key: 'target_id' },
      { header: 'Event Details', key: 'details' },
      { header: 'IP Address', key: 'ip_address' },
    ];
    const rows = logs.map((l) => ({
      timestamp: formatDateTime(l.created_at),
      actor_name: l.actor_name || 'System / Automated',
      actor_email: l.actor_email || '',
      action: formatActionLabel(l.action),
      target_type: l.target_type,
      target_id: l.target_id || '',
      details: l.details || '',
      ip_address: l.ip_address || '',
    }));
    exportToCsv({
      filename: `studymate_audit_logs_${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows,
    });
    showToast('Audit trail exported to clean UTF-8 CSV successfully.', 'success');
  };

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto relative">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-sm flex items-center gap-2 border ${
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security & Audit Logs</h1>
          <p className="text-sm text-slate-400 mt-1">
            Tamper-evident operational audit trail recording all administrative actions and security events
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={exportAuditExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Download formatted Excel sheet with pre-configured column widths and dark header"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xls)</span>
          </button>
          <button
            onClick={exportAuditCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            title="Download clean UTF-8 CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl">
            Total Logged Actions: <strong className="text-white">{total}</strong>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter audit logs by action"
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Administrative Actions</option>
          <option value="user_suspended">User Suspended</option>
          <option value="user_reactivated">User Reactivated</option>
          <option value="password_reset_triggered">Password Recovery Initiated</option>
          <option value="ai_model_updated">AI Model Updated</option>
          <option value="announcement_created">Announcement Created</option>
          <option value="announcement_updated">Announcement Updated/Toggled</option>
          <option value="announcement_deleted">Announcement Deleted</option>
        </select>

        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Admin Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Entity</th>
                <th className="py-3.5 px-4">Event Details</th>
                <th className="py-3.5 px-4 text-right">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-white">{log.actor_name || 'System'}</p>
                          {log.actor_email && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              {log.actor_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        label={log.action}
                        variant={
                          log.action.includes('suspended')
                            ? 'danger'
                            : log.action.includes('reactivated')
                            ? 'success'
                            : log.action.includes('ai_model')
                            ? 'purple'
                            : 'info'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {log.target_type}: {log.target_id || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-sm">
                      <p className="truncate" title={log.details || ''}>
                        {log.details || '-'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

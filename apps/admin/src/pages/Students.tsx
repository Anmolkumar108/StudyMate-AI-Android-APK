import React, { useEffect, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  Eye,
  RefreshCw,
  AlertTriangle,
  X,
  CheckCircle,
  Download,
  KeyRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { adminApi } from '../api/client';
import { AdminUser, StudentDetail, UserStatus } from '../types';
import { Badge } from '../components/Badge';
import {
  exportToExcel,
  exportToCsv,
  formatDateTime,
  ExportColumn,
} from '../utils/exportUtils';

export const Students: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected student for detail modal
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetTokenInfo, setResetTokenInfo] = useState<string | null>(null);
  const [exportingGdpr, setExportingGdpr] = useState(false);
  const [forceLoggingOutId, setForceLoggingOutId] = useState<string | null>(null);

  // Suspend modal state
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      if (e instanceof Error) {
        showToast(e.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleViewDetail = async (userId: string) => {
    setDetailLoadingId(userId);
    setResetTokenInfo(null);
    try {
      const detail = await adminApi.getUserDetail(userId);
      setSelectedStudent(detail);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    setResettingPassword(true);
    try {
      const res = await adminApi.resetStudentPassword(userId);
      setResetTokenInfo(res.temporary_token || 'Reset initiated');
      showToast(res.message, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleExportGdpr = async (userId: string, email: string) => {
    setExportingGdpr(true);
    try {
      const data = await adminApi.exportStudentData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `studymate_export_${email.split('@')[0]}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Student GDPR archive exported and downloaded.', 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setExportingGdpr(false);
    }
  };

  const handleForceLogoutSingle = async (userId: string, email: string) => {
    setForceLoggingOutId(userId);
    try {
      await adminApi.forceLogoutSingleStudent(userId);
      showToast(`All active sessions & refresh tokens revoked for ${email}.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setForceLoggingOutId(null);
    }
  };

  const handleSuspendSubmit = async () => {
    if (!suspendTarget) return;
    setActionLoading(true);
    try {
      const updated = await adminApi.suspendUser(suspendTarget.id, suspendReason);
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
      if (selectedStudent && selectedStudent.id === updated.id) {
        setSelectedStudent({ ...selectedStudent, status: updated.status });
      }
      showToast(`Student ${updated.email} suspended and all active tokens revoked.`, 'success');
      setSuspendTarget(null);
      setSuspendReason('');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (user: AdminUser) => {
    setActionLoading(true);
    try {
      const updated = await adminApi.reactivateUser(user.id);
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
      if (selectedStudent && selectedStudent.id === updated.id) {
        setSelectedStudent({ ...selectedStudent, status: updated.status });
      }
      showToast(`Student ${updated.email} reactivated successfully.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const exportStudentsExcel = () => {
    if (users.length === 0) {
      showToast('No student records to export.', 'error');
      return;
    }
    const columns: ExportColumn[] = [
      { header: 'Student ID', key: 'id', width: 140 },
      { header: 'Full Name', key: 'full_name', width: 180 },
      { header: 'Email Address', key: 'email', width: 220 },
      { header: 'Account Role', key: 'role', width: 110 },
      { header: 'Status', key: 'status', width: 110 },
      { header: 'Registration Date', key: 'created_at', width: 150 },
      { header: 'Last Login Activity', key: 'last_login_at', width: 150 },
    ];
    const rows = users.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role.toUpperCase(),
      status: u.status.toUpperCase(),
      created_at: formatDateTime(u.created_at),
      last_login_at: u.last_login_at ? formatDateTime(u.last_login_at) : 'Never',
    }));
    exportToExcel({
      filename: `studymate_students_directory_${new Date().toISOString().split('T')[0]}.xls`,
      sheetName: 'Students',
      columns,
      rows,
    });
    showToast('Students directory exported to Excel (.xls) with custom columns & formatting.', 'success');
  };

  const exportCsv = () => {
    if (users.length === 0) {
      showToast('No student records to export.', 'error');
      return;
    }
    const columns: ExportColumn[] = [
      { header: 'ID', key: 'id' },
      { header: 'Full Name', key: 'full_name' },
      { header: 'Email', key: 'email' },
      { header: 'Role', key: 'role' },
      { header: 'Status', key: 'status' },
      { header: 'Registered At', key: 'created_at' },
      { header: 'Last Login', key: 'last_login_at' },
    ];
    const rows = users.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      status: u.status,
      created_at: formatDateTime(u.created_at),
      last_login_at: u.last_login_at ? formatDateTime(u.last_login_at) : 'Never',
    }));
    exportToCsv({
      filename: `studymate_students_${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows,
    });
    showToast('Students directory exported to clean UTF-8 CSV successfully.', 'success');
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

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
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student Directory & Moderation</h1>
          <p className="text-sm text-slate-400 mt-1">
            Search registered students, inspect academic engagement metrics, and enforce account governance
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={exportStudentsExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Download formatted Excel sheet with pre-configured column widths and dark header"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xls)</span>
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            title="Download clean UTF-8 CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl">
            Total Students: <strong className="text-white">{total}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students by name or email..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as UserStatus | '');
            setPage(1);
          }}
          aria-label="Filter students by status"
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Account Statuses</option>
          <option value="active">Active Only</option>
          <option value="suspended">Suspended Only</option>
          <option value="pending_verification">Pending Email Verification</option>
        </select>

        <button
          onClick={() => {
            setPage(1);
            loadUsers();
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Registered Date</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading student records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                          {u.full_name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{u.full_name}</p>
                          <p className="text-slate-400 text-[11px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        label={u.role}
                        variant={u.role === 'super_admin' ? 'purple' : u.role === 'support_admin' ? 'info' : 'neutral'}
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        label={u.status}
                        variant={
                          u.status === 'active'
                            ? 'success'
                            : u.status === 'suspended'
                            ? 'danger'
                            : 'warning'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetail(u.id)}
                          title="View Profile & Stats"
                          disabled={detailLoadingId === u.id}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          {detailLoadingId === u.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>

                        {u.role !== 'super_admin' && (
                          <>
                            {u.status === 'active' ? (
                              <button
                                onClick={() => setSuspendTarget(u)}
                                title="Suspend Student Account"
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(u)}
                                title="Reactivate Account"
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/40 rounded-lg transition-colors"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing <strong>{users.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{' '}
            <strong>{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong> students
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Student Detail Drawer */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm">
                  {selectedStudent.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedStudent.full_name}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Academic Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-[11px]">Enrolled Subjects</p>
                <p className="text-lg font-bold text-white mt-1">
                  {selectedStudent.subjects_count}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-[11px]">Tasks Logged</p>
                <p className="text-lg font-bold text-white mt-1">{selectedStudent.tasks_count}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-[11px]">Current Streak</p>
                <p className="text-lg font-bold text-amber-400 mt-1">
                  {selectedStudent.current_streak_days} days
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-[11px]">Cornell Notes</p>
                <p className="text-lg font-bold text-sky-400 mt-1">{selectedStudent.notes_count}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-[11px]">Flashcard Decks</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {selectedStudent.flashcards_count}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-[11px]">Total Focus Time</p>
                <p className="text-lg font-bold text-indigo-400 mt-1">
                  {Math.round(selectedStudent.total_focus_minutes / 60)} hrs
                </p>
              </div>
            </div>

            {/* Account Recovery Section */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span>Student Access Recovery</span>
                </div>
                <button
                  onClick={() => handleResetPassword(selectedStudent.id)}
                  disabled={resettingPassword}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {resettingPassword ? 'Generating...' : 'Issue Reset Code'}
                </button>
              </div>
              {resetTokenInfo && (
                <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs">
                  <p className="text-indigo-300 text-[11px] font-medium">
                    Temporary Student Recovery Code:
                  </p>
                  <p className="text-white font-mono font-bold text-sm tracking-wider mt-0.5 select-all">
                    {resetTokenInfo}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-1">
                    Provide this code to the student to verify identity and set a new password.
                  </p>
                </div>
              )}
            </div>

            {/* Active Device Sessions & Force Logout */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Active Device Sessions & Logins</span>
                </div>
                <button
                  onClick={() => handleForceLogoutSingle(selectedStudent.id, selectedStudent.email)}
                  disabled={forceLoggingOutId === selectedStudent.id}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{forceLoggingOutId === selectedStudent.id ? 'Revoking...' : 'Force Logout Devices'}</span>
                </button>
              </div>
              <p className="text-slate-400 text-[10px]">
                Immediately revokes all active JWT access tokens and database refresh sessions across Android apps and browser sessions for this student.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleExportGdpr(selectedStudent.id, selectedStudent.email)}
                disabled={exportingGdpr}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingGdpr ? 'Exporting Archive...' : 'Download GDPR Archive (JSON)'}</span>
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-white text-base">Suspend Student Account</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to suspend <strong>{suspendTarget.full_name}</strong> (
              {suspendTarget.email})?
            </p>
            <p className="text-[11px] text-rose-400/90 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40">
              ⚠️ This will immediately bump the user token version and revoke all active mobile
              sessions. The student will be logged out instantly and blocked from logging in.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reason for Suspension (Optional)
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Terms of service violation, spamming, academic dishonesty..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSuspendTarget(null);
                  setSuspendReason('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Plus,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  Mail,
  User as UserIcon,
  Shield,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { adminApi, authStorage } from '../api/client';
import { AdminUser, UserRole, UserStatus } from '../types';
import { Badge } from '../components/Badge';

export const Staff: React.FC = () => {
  const [staffList, setStaffList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Current logged in admin
  const currentAdmin = authStorage.getUser();

  // Create Form State
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('support_admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val.trim());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getStaffUsers();
      setStaffList(res);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password) return;

    if (!isValidEmail(email)) {
      showToast('Please enter a valid email address with a domain (e.g. name@domain.com)', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const created = await adminApi.createStaffUser({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
        password,
      });
      setStaffList([...staffList, created]);
      setModalOpen(false);
      setEmail('');
      setFullName('');
      setPassword('');
      showToast(`Staff member '${created.full_name}' provisioned as ${created.role}.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (user.id === currentAdmin?.id) {
      showToast('You cannot suspend your own administrative account.', 'error');
      return;
    }

    const nextStatus: UserStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const updated = await adminApi.updateStaffStatus(user.id, nextStatus);
      setStaffList(staffList.map((u) => (u.id === user.id ? updated : u)));
      showToast(`Staff account '${user.full_name}' is now ${nextStatus}.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const handleChangeRole = async (user: AdminUser, newRole: UserRole) => {
    if (user.id === currentAdmin?.id && newRole !== 'super_admin') {
      showToast('You cannot demote your own super administrator role.', 'error');
      return;
    }

    try {
      const updated = await adminApi.updateStaffRole(user.id, newRole);
      setStaffList(staffList.map((u) => (u.id === user.id ? updated : u)));
      showToast(`Role for '${user.full_name}' updated to ${newRole}.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || newPassword.length < 8) return;

    setResetting(true);
    try {
      await adminApi.resetStaffPassword(resetModalUser.id, newPassword);
      setResetModalUser(null);
      setNewPassword('');
      showToast(`Password successfully reset for staff '${resetModalUser.full_name}'.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteStaff = async (user: AdminUser) => {
    if (user.id === currentAdmin?.id) {
      showToast('You cannot delete your own administrative account.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete staff member "${user.full_name}" (${user.email})?`)) {
      return;
    }

    try {
      await adminApi.deleteStaffUser(user.id);
      setStaffList(staffList.filter((u) => u.id !== user.id));
      showToast(`Staff account '${user.full_name}' deleted permanently.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Administrative Staff & RBAC
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Role-Based Access Control: provision support agents, content managers, and administrators (AR-01)
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Staff</span>
        </button>
      </div>

      {/* Permissions Guide Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Super Administrator</h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Full root privileges: switch active AI models, set daily budget limits, manage staff accounts, and view security audit logs.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Support Administrator</h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Student moderation: search students, inspect study metrics, suspend/reactivate accounts, and issue emergency recovery reset codes.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Content Manager</h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Curriculum publisher: create and manage university starter subjects, curate task workflows, and publish mobile broadcast banners.
          </p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Provisioned Date</th>
                <th className="py-3.5 px-4 text-center">Account Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading staff directory...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                staffList.map((s) => {
                  const isCurrent = s.id === currentAdmin?.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                            {s.full_name?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-white">{s.full_name}</p>
                              {isCurrent && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-[11px] font-mono">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={s.role}
                          disabled={isCurrent}
                          onChange={(e) => handleChangeRole(s, e.target.value as UserRole)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                          <option value="super_admin">Super Administrator</option>
                          <option value="support_admin">Support Administrator</option>
                          <option value="content_manager">Content Manager</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          label={s.status}
                          variant={s.status === 'active' ? 'success' : 'danger'}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Toggle Status Button */}
                          <button
                            onClick={() => handleToggleStatus(s)}
                            disabled={isCurrent}
                            title={s.status === 'active' ? 'Suspend Staff' : 'Reactivate Staff'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${
                              isCurrent
                                ? 'opacity-40 cursor-not-allowed border-slate-800 text-slate-600'
                                : s.status === 'active'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20'
                            }`}
                          >
                            {s.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>

                          {/* Reset Password Button */}
                          <button
                            onClick={() => {
                              setResetModalUser(s);
                              setNewPassword('');
                            }}
                            title="Reset Staff Password"
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteStaff(s)}
                            disabled={isCurrent}
                            title={isCurrent ? 'Cannot delete current account' : 'Delete Staff'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${
                              isCurrent
                                ? 'opacity-40 cursor-not-allowed border-slate-800 text-slate-600'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Provision Staff Account</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. anmol@gmail.com or staff@studymate.ai"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {email.length > 0 && !isValidEmail(email) ? (
                  <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>Include a valid domain (e.g. anmol@gmail.com or anmol@company.com)</span>
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="support_admin">Support Administrator (Student Moderation & Recovery)</option>
                  <option value="content_manager">Content Manager (Curriculum & Broadcasts)</option>
                  <option value="super_admin">Super Administrator (Full System Root)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Temporary Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="text-[11px] text-rose-400 mt-1">Must be at least 8 characters long</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isValidEmail(email) || password.length < 8 || !fullName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 shadow-md shadow-indigo-600/30"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Reset Staff Password</h3>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Issue a new password for <span className="text-white font-semibold">{resetModalUser.full_name}</span> ({resetModalUser.email}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting || newPassword.length < 8}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {resetting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

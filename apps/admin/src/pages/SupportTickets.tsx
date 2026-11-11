import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SupportTicket, TicketPriority, TicketStatus } from '../types';

export const SupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Selected Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<TicketStatus>('open');
  const [updatePriority, setUpdatePriority] = useState<TicketPriority>('medium');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [resolutionSummary, setResolutionSummary] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getSupportTickets({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        category: categoryFilter || undefined,
        search: search.trim() || undefined,
      });
      setTickets(res.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
  };

  const openTicketModal = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setUpdateStatus(ticket.status);
    setUpdatePriority(ticket.priority);
    setAdminNotes(ticket.admin_notes || '');
    setResolutionSummary(ticket.resolution_summary || '');
    setActionSuccess(null);
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;
    try {
      setIsUpdating(true);
      setError(null);
      const updated = await apiClient.updateSupportTicket(selectedTicket.id, {
        status: updateStatus,
        priority: updatePriority,
        admin_notes: adminNotes.trim() || undefined,
        resolution_summary: resolutionSummary.trim() || undefined,
      });
      setSelectedTicket(updated);
      setActionSuccess('Ticket updated successfully!');
      fetchTickets();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket');
    } finally {
      setIsUpdating(false);
    }
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'low':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'in_progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'resolved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'closed':
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-600/40';
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Support & Complaints Center</h1>
            <p className="text-xs text-slate-400">
              Student issue escalation, bug tickets, and SLA resolutions
            </p>
          </div>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Main Container */}
      <div className="p-6 space-y-6 flex-1">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-medium">Total Tickets</span>
            <div className="text-2xl font-bold text-white mt-1">{tickets.length}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-amber-400 font-medium">Open & Pending</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-red-400 font-medium">Urgent / High Priority</span>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {tickets.filter((t) => t.priority === 'urgent' || t.priority === 'high').length}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-emerald-400 font-medium">Resolved</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length}
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ticket #, subject, student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              <option value="bug">Bugs</option>
              <option value="complaint">Complaints</option>
              <option value="feature_request">Feature Requests</option>
              <option value="academic_query">Academic Queries</option>
              <option value="account_issue">Account Issues</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tickets Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Ticket</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Reporter</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading support inquiries...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No support tickets found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => openTicketModal(t)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                        {t.ticket_number}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate font-medium text-white">
                        {t.subject}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                          {t.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`capitalize px-2 py-0.5 rounded text-[11px] font-semibold border ${getPriorityBadge(
                            t.priority
                          )}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`capitalize px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(
                            t.status
                          )}`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-white truncate max-w-[120px]">
                          {t.user_name || 'Student'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {t.user_email || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTicketModal(t);
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket Details & Management Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400">
                      {selectedTicket.ticket_number}
                    </span>
                    <span
                      className={`capitalize px-2 py-0.5 rounded text-[10px] font-semibold border ${getPriorityBadge(
                        selectedTicket.priority
                      )}`}
                    >
                      {selectedTicket.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-0.5">{selectedTicket.subject}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
              {actionSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Student Metadata Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Student Name</span>
                  <div className="font-semibold text-white mt-0.5">{selectedTicket.user_name || 'Student'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Student Email</span>
                  <div className="font-mono text-slate-300 mt-0.5">{selectedTicket.user_email || '—'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Category</span>
                  <div className="capitalize text-slate-200 mt-0.5">
                    {selectedTicket.category.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Submitted At</span>
                  <div className="text-slate-300 mt-0.5">
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Student Issue Description */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Reported Issue Description
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Status and Priority Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Update Status
                  </label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value as TicketStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Update Priority
                  </label>
                  <select
                    value={updatePriority}
                    onChange={(e) => setUpdatePriority(e.target.value as TicketPriority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Resolution Summary */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Resolution Summary (Sent to Student)
                </label>
                <textarea
                  rows={2}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Explain how the issue was fixed or resolved..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Internal Admin Notes */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Internal Administrative Notes (Confidential)
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Private notes for staff members..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUpdateTicket}
                disabled={isUpdating}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save Ticket Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

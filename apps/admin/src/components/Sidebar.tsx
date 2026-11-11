import React from 'react';
import {
  Activity,
  LayoutDashboard,
  Users,
  Bot,
  Megaphone,
  ShieldCheck,
  LogOut,
  Sparkles,
  GraduationCap,
  Shield,
  LifeBuoy,
  Sliders,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import { AdminUser } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  adminUser,
  onLogout,
}) => {
  const isSuperAdmin = adminUser?.role === 'super_admin';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'device-intelligence', label: 'Device Radar & Security', icon: Smartphone },
    { id: 'support-tickets', label: 'Support & Tickets', icon: LifeBuoy },
    { id: 'templates', label: 'Curated Templates', icon: GraduationCap },
    { id: 'announcements', label: 'Broadcasts', icon: Megaphone },
    { id: 'ai-governance', label: 'AI Governance', icon: Bot },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'app-config', label: 'Remote Config', icon: Sliders },
    { id: 'system-health', label: 'System & Telemetry', icon: Activity },
    { id: 'audit-logs', label: 'Audit Logs', icon: ShieldCheck },
    ...(isSuperAdmin ? [{ id: 'staff', label: 'Staff & Roles', icon: Shield }] : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-none">
            StudyMate AI
          </h1>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
            Admin Console
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Admin Profile Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">
              {adminUser?.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {adminUser?.full_name || 'Admin'}
              </p>
              <p className="text-[10px] text-slate-400 capitalize truncate">
                {adminUser?.role?.replace('_', ' ') || 'Super Admin'}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[11px] text-slate-500 text-center">
          StudyMate AI v1.0.0 (Production)
        </div>
      </div>
    </aside>
  );
};


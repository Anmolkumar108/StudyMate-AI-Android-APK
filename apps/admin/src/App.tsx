import React, { useState, useEffect } from 'react';
import { authStorage, adminApi } from './api/client';
import { AdminUser } from './types';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { DeviceIntelligence } from './pages/DeviceIntelligence';
import { AIGovernance } from './pages/AIGovernance';
import { Announcements } from './pages/Announcements';
import { AuditLogs } from './pages/AuditLogs';
import { Templates } from './pages/Templates';
import { Staff } from './pages/Staff';
import { SystemHealth } from './pages/SystemHealth';
import { SupportTickets } from './pages/SupportTickets';
import { AppConfiguration } from './pages/AppConfiguration';
import { Subscriptions } from './pages/Subscriptions';

export const App: React.FC = () => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(authStorage.getUser());
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setAdminUser(null);
        setCheckingAuth(false);
        return;
      }
      try {
        const user = await adminApi.getMe();
        setAdminUser(user);
        authStorage.setUser(user);
      } catch {
        authStorage.clear();
        setAdminUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };
    verifyAuth();
  }, []);

  const handleLogout = () => {
    authStorage.clear();
    setAdminUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Verifying administrative authorization...
      </div>
    );
  }

  if (!adminUser) {
    return <Login onLoginSuccess={(u) => setAdminUser(u)} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        adminUser={adminUser}
        onLogout={handleLogout}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-screen overflow-y-auto bg-slate-950">
        {currentTab === 'dashboard' && <Dashboard onNavigate={setCurrentTab} />}
        {currentTab === 'students' && <Students />}
        {currentTab === 'device-intelligence' && <DeviceIntelligence />}
        {currentTab === 'support-tickets' && <SupportTickets />}
        {currentTab === 'templates' && <Templates />}
        {currentTab === 'ai-governance' && <AIGovernance />}
        {currentTab === 'subscriptions' && <Subscriptions />}
        {currentTab === 'app-config' && <AppConfiguration />}
        {currentTab === 'system-health' && <SystemHealth />}
        {currentTab === 'announcements' && <Announcements />}
        {currentTab === 'audit-logs' && <AuditLogs />}
        {currentTab === 'staff' && <Staff />}
      </main>
    </div>
  );
};

export default App;


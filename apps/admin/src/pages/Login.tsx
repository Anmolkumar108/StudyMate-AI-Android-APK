import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import { adminApi } from '../api/client';
import { AdminUser } from '../types';

interface LoginProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val.trim());

  const handleClearForm = () => {
    setEmail('');
    setPassword('');
    setSecurityPin('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !securityPin.trim()) return;

    if (!isValidEmail(email)) {
      setError('Please provide a valid administrative email address (e.g. admin@domain.com)');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await adminApi.login(email.trim(), password, securityPin.trim());
      onLoginSuccess(res.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')) {
          setError('Backend server connection refused. Ensure the FastAPI backend is running on port 8000.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Authentication failed. Please verify administrative credentials and master passkey.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/30 mb-3 border border-indigo-400/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">StudyMate AI</h2>
          <p className="text-xs text-slate-400 mt-1">Platform Administration & Governance Console</p>

          {/* Hardened Security Badge */}
          <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>MFA Protected • Rate Limited • Tamper-Evident</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {/* Invisible dummy inputs to defeat aggressive browser autofill traps */}
          <input
            type="text"
            name="prevent_browser_autofill_username"
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
          />
          <input
            type="password"
            name="prevent_browser_autofill_password"
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="new-password"
          />

          {/* Field 1: Administrator Email */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Administrator Email
              </label>
              {(email || password || securityPin) && (
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                name="admin_usr_credential"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="name@domain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Field 2: Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Secure Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                name="admin_pwd_credential"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Field 3: Master Security Passkey (MFA Key) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Master Security Passkey / 2FA PIN
              </label>
              <span className={`text-[11px] font-mono ${securityPin.length === 6 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                {securityPin.length}/6 digits
              </span>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPin ? 'text' : 'password'}
                required
                name="admin_2fa_pin_field"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={securityPin}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                  setSecurityPin(cleaned);
                  if (error) setError(null);
                }}
                placeholder="••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors tracking-widest font-mono text-center sm:text-left"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                aria-label="Toggle security passkey visibility"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Enter the confidential 6-digit administrative security passkey.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating Secure Session...</span>
            ) : (
              <>
                <span>Sign In to Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-slate-300">Zero-Trust Administrative Safeguard</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Argon2id password hashes • 5 failed attempts lockout threshold • All administrative actions recorded in forensic audit log.
          </p>
        </div>
      </div>
    </div>
  );
};

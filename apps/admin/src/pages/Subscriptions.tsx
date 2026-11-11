import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Tag,
  ShieldCheck,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SubscriptionTier } from '../types';

export const Subscriptions: React.FC = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([
    {
      tier_id: 'free',
      name: 'Student Standard',
      price_inr: 0,
      features: ['100 Notes', '5 Subjects', '50 Daily AI Queries', 'Basic Pomodoro'],
    },
    {
      tier_id: 'pro',
      name: 'StudyMate Pro',
      price_inr: 199,
      features: [
        'Unlimited Notes',
        'Unlimited Subjects',
        '500 Daily AI Queries',
        'Exam Predictor',
        'Priority AI Model',
      ],
    },
  ]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Edit tier modal
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [tierName, setTierName] = useState<string>('');
  const [tierPrice, setTierPrice] = useState<number>(0);
  const [tierFeaturesText, setTierFeaturesText] = useState<string>('');

  const fetchTiers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getAppConfigs();
      const subConfig = res.items.find((c) => c.key === 'subscription_tiers');
      if (subConfig && Array.isArray(subConfig.value)) {
        setTiers(subConfig.value);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  const openEditModal = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setTierName(tier.name);
    setTierPrice(tier.price_inr);
    setTierFeaturesText(tier.features.join('\n'));
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;
    try {
      setIsSaving(true);
      setError(null);
      const updatedTiers = tiers.map((t) => {
        if (t.tier_id === editingTier.tier_id) {
          return {
            ...t,
            name: tierName,
            price_inr: tierPrice,
            features: tierFeaturesText
              .split('\n')
              .map((f) => f.trim())
              .filter(Boolean),
          };
        }
        return t;
      });

      await apiClient.updateAppConfig(
        'subscription_tiers',
        updatedTiers,
        'Configured platform subscription tiers and feature entitlements.'
      );

      setTiers(updatedTiers);
      setEditingTier(null);
      setSuccess(`Plan '${tierName}' updated successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save subscription tier');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Subscriptions & Monetization</h1>
            <p className="text-xs text-slate-400">
              Manage student subscription tiers, pricing, quotas, and feature entitlements
            </p>
          </div>
        </div>
        <button
          onClick={fetchTiers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Main Container */}
      <div className="p-6 space-y-6 flex-1">
        {/* Alerts */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Revenue & Tier Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Active Plans</span>
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">{tiers.length} Tiers</div>
            <div className="text-[11px] text-slate-500 mt-1">Configured in production database</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Student Monetization Gate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">Active</div>
            <div className="text-[11px] text-slate-500 mt-1">Free Tier + StudyMate Pro</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Payment Gateway Mode</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">Ready</div>
            <div className="text-[11px] text-slate-500 mt-1">Razorpay / Stripe Webhook Protocol</div>
          </div>
        </div>

        {/* Subscription Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers.map((tier) => {
            const isPro = tier.tier_id === 'pro';
            return (
              <div
                key={tier.tier_id}
                className={`bg-slate-900/80 border rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden transition-all ${
                  isPro
                    ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/10'
                    : 'border-slate-800'
                }`}
              >
                {isPro && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500 to-purple-600 text-[10px] uppercase font-bold text-white px-3 py-1 rounded-bl-xl tracking-wider">
                    Recommended
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                      Tier: {tier.tier_id}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>

                  <div className="flex items-baseline gap-1 my-4">
                    <span className="text-3xl font-extrabold text-white">
                      ₹{tier.price_inr}
                    </span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>

                  <div className="border-t border-slate-800 my-4" />

                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Included Entitlements & Features:
                  </h4>
                  <ul className="space-y-2.5">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2.5 text-xs text-slate-200">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800/80">
                  <button
                    onClick={() => openEditModal(tier)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    Edit Tier Pricing & Entitlements
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Promotional Codes & Coupons Management Preview */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <Tag className="w-4 h-4 text-pink-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Promotional Coupons & Campus Partnerships</h3>
                <p className="text-xs text-slate-400">
                  University partner discount codes for student exam prep semesters
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Active Promo Engine
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Eligibility</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-400">CAMPUS50</td>
                  <td className="py-3 px-4 font-medium text-white">50% OFF Pro Monthly</td>
                  <td className="py-3 px-4 text-slate-300">Verified .edu / college email students</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                      Active
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-400">EXAMPREP100</td>
                  <td className="py-3 px-4 font-medium text-white">100% Free First Month</td>
                  <td className="py-3 px-4 text-slate-300">New Semester Onboarding</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                      Active
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Tier Modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Edit Tier: <span className="font-mono text-indigo-400">{editingTier.tier_id}</span>
              </h3>
              <button
                onClick={() => setEditingTier(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Tier Display Name
                </label>
                <input
                  type="text"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Monthly Price (INR ₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tierPrice}
                  onChange={(e) => setTierPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Features (One per line)
                </label>
                <textarea
                  rows={5}
                  value={tierFeaturesText}
                  onChange={(e) => setTierFeaturesText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTier}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

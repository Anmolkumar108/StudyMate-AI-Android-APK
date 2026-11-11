import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'indigo',
}) => {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      ring: 'hover:border-indigo-500/40',
    },
    emerald: {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      ring: 'hover:border-emerald-500/40',
    },
    amber: {
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      ring: 'hover:border-amber-500/40',
    },
    rose: {
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      ring: 'hover:border-rose-500/40',
    },
    sky: {
      bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      ring: 'hover:border-sky-500/40',
    },
  };

  const currentTheme = colorMap[color];

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm transition-all duration-200 ${currentTheme.ring}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${currentTheme.bg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};


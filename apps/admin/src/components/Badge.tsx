import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    purple: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border capitalize ${styles[variant]}`}
    >
      {label.replace('_', ' ')}
    </span>
  );
};


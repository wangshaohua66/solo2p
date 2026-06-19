import type { TaskStatus, ResourcePool, Theme } from '@/types';

export function statusColor(status: TaskStatus, theme: Theme): { bg: string; bgProgress: string; border: string; text: string } {
  const map: Record<TaskStatus, { light: { bg: string; bgProgress: string; border: string; text: string }; dark: { bg: string; bgProgress: string; border: string; text: string } }> = {
    'not-started': {
      light: { bg: 'bg-slate-300/60', bgProgress: 'bg-slate-400', border: 'border-slate-400', text: 'text-slate-700' },
      dark: { bg: 'bg-slate-700/60', bgProgress: 'bg-slate-500', border: 'border-slate-500', text: 'text-slate-200' },
    },
    'in-progress': {
      light: { bg: 'bg-blue-400/50', bgProgress: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-900' },
      dark: { bg: 'bg-blue-600/50', bgProgress: 'bg-blue-400', border: 'border-blue-400', text: 'text-blue-100' },
    },
    'completed': {
      light: { bg: 'bg-emerald-400/50', bgProgress: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-900' },
      dark: { bg: 'bg-emerald-600/50', bgProgress: 'bg-emerald-400', border: 'border-emerald-400', text: 'text-emerald-100' },
    },
    'delayed': {
      light: { bg: 'bg-rose-400/50', bgProgress: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-900' },
      dark: { bg: 'bg-rose-600/50', bgProgress: 'bg-rose-400', border: 'border-rose-400', text: 'text-rose-100' },
    },
  };
  return map[status][theme];
}

export function poolColor(pool: ResourcePool): string {
  switch (pool) {
    case 'product': return 'bg-violet-500';
    case 'design': return 'bg-pink-500';
    case 'development': return 'bg-blue-500';
    case 'testing': return 'bg-amber-500';
  }
}

export function poolLabel(pool: ResourcePool): string {
  switch (pool) {
    case 'product': return '产品';
    case 'design': return '设计';
    case 'development': return '开发';
    case 'testing': return '测试';
  }
}

export function workloadColor(ratio: number): string {
  if (ratio >= 1.1) return 'bg-rose-500';
  if (ratio >= 0.9) return 'bg-amber-500';
  if (ratio >= 0.6) return 'bg-lime-500';
  if (ratio >= 0.3) return 'bg-emerald-400';
  return 'bg-emerald-200';
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

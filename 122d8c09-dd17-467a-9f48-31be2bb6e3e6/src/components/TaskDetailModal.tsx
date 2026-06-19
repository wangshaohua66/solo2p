import React, { memo } from 'react';
import { X, Calendar, User, Clock, AlertTriangle, GripVertical } from 'lucide-react';
import { useGanttStore } from '@/store/useGanttStore';
import { formatDate } from '@/utils/dateUtils';
import { statusColor, initials, poolLabel } from '@/utils/colorUtils';

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  'not-started': '未开始',
  'in-progress': '进行中',
  'completed': '已完成',
  'delayed': '已延期',
};

export const TaskDetailModal = memo(function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const tasks = useGanttStore(s => s.tasks);
  const resources = useGanttStore(s => s.resources);
  const dependencies = useGanttStore(s => s.dependencies);
  const baselines = useGanttStore(s => s.baselines);
  const activeBaselineId = useGanttStore(s => s.activeBaselineId);
  const deleteTask = useGanttStore(s => s.deleteTask);

  const task = tasks[taskId];
  if (!task) return null;

  const assignee = task.assigneeId ? resources.find(r => r.id === task.assigneeId) : null;
  const inDeps = dependencies.filter(d => d.toTaskId === taskId);
  const outDeps = dependencies.filter(d => d.fromTaskId === taskId);
  const colors = statusColor(task.status, theme);
  const baseline = baselines.find(b => b.id === activeBaselineId);
  const baselineTask = baseline?.tasks.find(bt => bt.taskId === taskId);

  const durationDays = Math.max(1, Math.round((task.endDate - task.startDate) / (24 * 60 * 60 * 1000)) + 1);
  let baselineDiff = 0;
  if (baselineTask) {
    baselineDiff = Math.round((task.startDate - baselineTask.startDate) / (24 * 60 * 60 * 1000));
  }

  const panelBg = theme === 'dark' ? 'bg-slate-800' : 'bg-white';
  const borderClr = theme === 'dark' ? 'border-slate-700' : 'border-slate-200';
  const textPrimary = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const inputCls = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl shadow-2xl border ${panelBg} ${borderClr} animate-[modalIn_200ms_ease-out]`}
      >
        <div className={`sticky top-0 z-10 flex items-start gap-3 p-5 border-b ${panelBg} ${borderClr}`}>
          <div className={`w-1.5 h-14 rounded-full ${colors.bgProgress}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-xl font-bold ${textPrimary}`}>{task.name}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                {STATUS_LABEL[task.status]}
              </span>
              {task.isMilestone && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-500 border border-violet-500/40">
                  里程碑
                </span>
              )}
            </div>
            <div className={`text-xs mt-1 ${textSecondary}`}>
              ID: {task.id} · 层级 L{task.level}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border ${borderClr}`}>
              <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-1.5 ${textSecondary}`}>
                <Calendar size={12} /> 开始时间
              </div>
              <div className={`text-sm font-semibold ${textPrimary}`}>{formatDate(task.startDate, 'long')}</div>
            </div>
            <div className={`p-3 rounded-xl border ${borderClr}`}>
              <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-1.5 ${textSecondary}`}>
                <Calendar size={12} /> 结束时间
              </div>
              <div className={`text-sm font-semibold ${textPrimary}`}>{formatDate(task.endDate, 'long')}</div>
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${borderClr}`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${textSecondary}`}>
                <Clock size={12} /> 完成进度 · {durationDays} 天
              </div>
              <span className={`text-sm font-bold tabular-nums ${textPrimary}`}>{task.progress}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div className={`h-full rounded-full ${colors.bgProgress} transition-all`} style={{ width: `${task.progress}%` }} />
            </div>
          </div>

          {baselineTask && (
            <div className={`p-3 rounded-xl border ${baselineDiff === 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
              <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-2 ${textSecondary}`}>
                <GripVertical size={12} /> 基线对比「{baseline?.name}」
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <div className={`text-[10px] ${textSecondary}`}>计划开始</div>
                  <div className={`text-xs font-semibold ${textPrimary}`}>{formatDate(baselineTask.startDate, 'short')}</div>
                </div>
                <div>
                  <div className={`text-[10px] ${textSecondary}`}>实际开始</div>
                  <div className={`text-xs font-semibold ${textPrimary}`}>{formatDate(task.startDate, 'short')}</div>
                </div>
                <div className={`px-2 py-1 rounded-md text-xs font-bold ${
                  baselineDiff === 0
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : baselineDiff > 0
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-sky-500/20 text-sky-500'
                }`}>
                  {baselineDiff === 0 ? '如期' : baselineDiff > 0 ? `延期 ${baselineDiff} 天` : `提前 ${-baselineDiff} 天`}
                </div>
              </div>
            </div>
          )}

          <div className={`p-3 rounded-xl border ${borderClr}`}>
            <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-2 ${textSecondary}`}>
              <User size={12} /> 负责人
            </div>
            {assignee ? (
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${
                  assignee.pool === 'product' ? 'from-violet-500 to-fuchsia-600' :
                  assignee.pool === 'design' ? 'from-pink-500 to-rose-600' :
                  assignee.pool === 'development' ? 'from-blue-500 to-indigo-600' :
                  'from-amber-500 to-orange-600'
                }`}>
                  {initials(assignee.name)}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${textPrimary}`}>{assignee.name}</div>
                  <div className={`text-[10px] ${textSecondary}`}>{poolLabel(assignee.pool)} · 每天 {assignee.capacityPerDay}h</div>
                </div>
              </div>
            ) : (
              <div className={`text-sm ${textSecondary}`}>未分配</div>
            )}
          </div>

          {(inDeps.length > 0 || outDeps.length > 0) && (
            <div className={`p-3 rounded-xl border ${borderClr}`}>
              <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-2 ${textSecondary}`}>
                <AlertTriangle size={12} /> 依赖关系
              </div>
              <div className="space-y-2">
                {inDeps.map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-500/20 text-slate-400">{d.type}</span>
                    <span className={`text-xs ${textSecondary}`}>前置:</span>
                    <span className={`text-xs font-medium truncate ${textPrimary}`}>{tasks[d.fromTaskId]?.name}</span>
                    {d.lagDays > 0 && <span className="text-[10px] text-amber-500">+{d.lagDays}天</span>}
                  </div>
                ))}
                {outDeps.map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-400">{d.type}</span>
                    <span className={`text-xs ${textSecondary}`}>后置:</span>
                    <span className={`text-xs font-medium truncate ${textPrimary}`}>{tasks[d.toTaskId]?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`sticky bottom-0 flex items-center justify-end gap-2 p-4 border-t ${panelBg} ${borderClr}`}>
          <button
            onClick={() => {
              if (confirm('确定删除此任务？')) {
                deleteTask(taskId);
                onClose();
              }
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              theme === 'dark' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            删除任务
          </button>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-md text-xs font-medium ${
              theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            关闭
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { transform: translateY(16px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
});

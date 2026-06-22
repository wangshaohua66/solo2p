import { useState, useCallback } from 'react';
import { 
  CloudRain, 
  Wrench, 
  ShieldAlert, 
  Play,
  Clock,
  CheckCircle2,
  Circle,
  Bell,
  MessageSquare,
  Phone,
  Mail,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  User,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useEmergencyStore } from '@/store/useEmergencyStore';
import { cn } from '@/utils/helpers';
import { formatDateTime, formatRelativeTime } from '@/utils/dateUtils';
import { emergencyApi, type EmergencyReportResponse } from '@/services/api/emergencyApi';

export default function Emergency() {
  const { plans, activeLog, isEmergencyActive, triggerPlan, resolveEmergency: storeResolveEmergency, logs } = useEmergencyStore();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [resolveProgress, setResolveProgress] = useState<number | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reportData, setReportData] = useState<EmergencyReportResponse | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const handleTrigger = (planId: string) => {
    triggerPlan(planId);
    setSelectedPlanId(planId);
    setReportData(null);
    setResolveStatus('idle');
  };

  const handleResolve = useCallback(async () => {
    if (!activeLog || resolveStatus === 'loading') return;
    
    try {
      setResolveStatus('loading');
      setResolveProgress(0);
      
      const report = await emergencyApi.resolveEmergency(
        {
          logId: activeLog.id,
          resolvedBy: '当前用户',
          resolutionNotes: '应急事件已成功处置',
        },
        (progress) => setResolveProgress(progress)
      );
      
      storeResolveEmergency();
      setCompletedSteps(new Set());
      setReportData(report);
      setResolveStatus('success');
    } catch (err) {
      console.error('Failed to resolve emergency:', err);
      setResolveStatus('error');
      setTimeout(() => setResolveStatus('idle'), 3000);
    } finally {
      setResolveProgress(null);
    }
  }, [activeLog, resolveStatus, storeResolveEmergency]);

  const handleExportLogs = useCallback(async () => {
    if (exportStatus === 'loading') return;
    
    try {
      setExportStatus('loading');
      
      const blob = await emergencyApi.exportLogs({
        format: 'excel',
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `应急处置记录_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to export logs:', err);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  }, [exportStatus]);

  const handleDownloadReport = useCallback(async (logId: string) => {
    try {
      const blob = await emergencyApi.downloadReport(logId);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `应急处置报告_${logId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report:', err);
    }
  }, []);

  const planIcons: Record<string, any> = {
    weather: CloudRain,
    equipment: Wrench,
    security: ShieldAlert,
  };

  const planColors: Record<string, string> = {
    weather: 'from-blue-500 to-cyan-500',
    equipment: 'from-amber-500 to-orange-500',
    security: 'from-red-500 to-rose-500',
  };

  const planBgColors: Record<string, string> = {
    weather: 'bg-blue-500/10 border-blue-500/30',
    equipment: 'bg-amber-500/10 border-amber-500/30',
    security: 'bg-red-500/10 border-red-500/30',
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">应急管理</h1>
          <p className="text-slate-400 text-sm mt-1">
            预设应急预案 · 一键触发 · 多渠道通知
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              showLogs 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/50'
            )}
          >
            <FileText className="w-4 h-4" />
            处置记录
          </button>

          {showLogs && (
            <button
              onClick={handleExportLogs}
              disabled={exportStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                exportStatus === 'loading'
                  ? 'bg-slate-700 text-slate-400 cursor-wait'
                  : exportStatus === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : exportStatus === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/50'
              )}
            >
              {exportStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : exportStatus === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : exportStatus === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exportStatus === 'loading' ? '导出中...' : exportStatus === 'success' ? '导出成功' : '导出记录'}
            </button>
          )}
        </div>
      </div>

      {reportData && resolveStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-400">应急事件已解除</h3>
              <p className="text-green-300/70 text-sm mt-1">
                处置复盘报告已生成，点击下方链接下载
              </p>
            </div>
            <button
              onClick={() => handleDownloadReport(activeLog?.id || '')}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl font-medium hover:bg-green-500/30 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载报告
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-green-500/20">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-300/60">报告名称：{reportData.reportName}</span>
              <span className="text-green-300/60">生成时间：{formatDateTime(reportData.generatedAt)}</span>
              <span className="text-green-300/60">文件大小：{(reportData.fileSize / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>
      )}

      {isEmergencyActive && activeLog && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent animate-pulse" />
          {resolveStatus === 'loading' && resolveProgress !== null && (
            <div 
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${resolveProgress}%` }}
            />
          )}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-red-400">{activeLog.planName}</h2>
                  <span className="px-2 py-0.5 bg-red-500/30 text-red-300 rounded-full text-xs font-medium animate-pulse">
                    处置中
                  </span>
                </div>
                <p className="text-red-300/70 text-sm mt-1">
                  触发时间：{formatDateTime(activeLog.triggeredAt)} · 触发人：{activeLog.triggeredBy}
                </p>
              </div>
            </div>

            <button
              onClick={handleResolve}
              disabled={resolveStatus === 'loading'}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2',
                resolveStatus === 'loading'
                  ? 'bg-slate-700 text-slate-400 cursor-wait'
                  : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
              )}
            >
              {resolveStatus === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成报告中 {resolveProgress}%
                </>
              ) : (
                '确认解除'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {plans.map(plan => {
          const Icon = planIcons[plan.type] || ShieldAlert;
          const isActive = isEmergencyActive && activeLog?.planId === plan.id;
          
          return (
            <div
              key={plan.id}
              className={cn(
                'border rounded-2xl p-5 transition-all duration-300',
                isActive 
                  ? `${planBgColors[plan.type]} scale-[1.02] shadow-lg`
                  : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br',
                  planColors[plan.type]
                )}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                {isActive && (
                  <span className="px-2 py-1 bg-red-500/30 text-red-300 rounded-lg text-xs font-medium animate-pulse">
                    处置中
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
              <p className="text-slate-400 text-sm mb-4 line-clamp-2">{plan.description}</p>

              <div className="flex items-center gap-4 text-sm mb-4">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>{plan.estimatedDuration}分钟</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <User className="w-4 h-4" />
                  <span>{plan.notificationList.length}个岗位</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <FileText className="w-4 h-4" />
                  <span>{plan.steps.length}步</span>
                </div>
              </div>

              {!isActive ? (
                <button
                  onClick={() => handleTrigger(plan.id)}
                  className={cn(
                    'w-full py-3 rounded-xl font-bold text-white transition-all bg-gradient-to-r hover:shadow-lg hover:scale-[1.02]',
                    planColors[plan.type]
                  )}
                  style={{
                    boxShadow: `0 4px 20px ${plan.type === 'weather' ? 'rgba(59, 130, 246, 0.3)' : plan.type === 'equipment' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" />
                    一键触发
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setSelectedPlanId(plan.id)}
                  className="w-full py-3 bg-slate-700/50 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
                >
                  查看处置进度
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeLog && (
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          <div className="col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 overflow-auto">
            <h3 className="text-lg font-semibold text-white mb-4">处置流程</h3>
            <div className="space-y-1">
              {activeLog.steps.map((step, idx) => {
                const isCompleted = step.status === 'completed';
                const isInProgress = idx === activeLog.steps.findIndex(s => s.status !== 'completed');
                
                return (
                  <div key={step.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                        isCompleted && 'bg-green-500/20 text-green-400',
                        isInProgress && !isCompleted && 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500/50 animate-pulse',
                        !isCompleted && !isInProgress && 'bg-slate-700 text-slate-500'
                      )}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <span className="font-bold text-sm">{idx + 1}</span>
                        )}
                      </div>
                      {idx < activeLog.steps.length - 1 && (
                        <div className={cn(
                          'w-0.5 flex-1 my-1',
                          isCompleted ? 'bg-green-500/30' : 'bg-slate-700'
                        )} />
                      )}
                    </div>
                    
                    <div className="flex-1 pb-4">
                      <div className={cn(
                        'p-4 rounded-xl border',
                        isCompleted && 'bg-green-500/10 border-green-500/30',
                        isInProgress && !isCompleted && 'bg-cyan-500/10 border-cyan-500/30',
                        !isCompleted && !isInProgress && 'bg-slate-800/60 border-slate-700/50'
                      )}>
                        <div className="flex items-center justify-between">
                          <h4 className={cn(
                            'font-semibold',
                            isCompleted ? 'text-green-400' : isInProgress ? 'text-cyan-400' : 'text-slate-300'
                          )}>
                            {step.description}
                          </h4>
                          <span className="text-xs text-slate-500">
                            预计 {step.expectedDuration} 分钟
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          责任人：{step.responsibleRole}
                        </p>
                        {step.completedAt && step.completedBy && (
                          <p className="text-xs text-green-400/70 mt-2">
                            {step.completedBy} 于 {formatDateTime(step.completedAt)} 完成
                          </p>
                        )}
                        {isInProgress && !isCompleted && (
                          <button
                            onClick={() => {
                              useEmergencyStore.getState().completeStep(step.id, '当前用户');
                              setCompletedSteps(prev => new Set([...prev, step.id]));
                            }}
                            className="mt-3 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                          >
                            标记完成
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4">通知推送</h3>
            
            <div className="flex items-center gap-2 mb-4 text-sm">
              <div className="flex items-center gap-1 text-slate-400">
                <Bell className="w-4 h-4" />
                <span>已推送 {activeLog.notifications.length} 条</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {activeLog.notifications.map(notif => (
                <div 
                  key={notif.id}
                  className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white font-medium">{notif.recipient}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      notif.status === 'delivered' && 'bg-green-500/20 text-green-400',
                      notif.status === 'sent' && 'bg-amber-500/20 text-amber-400',
                      notif.status === 'read' && 'bg-cyan-500/20 text-cyan-400',
                      notif.status === 'failed' && 'bg-red-500/20 text-red-400',
                    )}>
                      {notif.status === 'delivered' ? '已送达' : notif.status === 'sent' ? '已发送' : notif.status === 'read' ? '已读' : '失败'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      {notif.channel === 'app' && <Bell className="w-3 h-3" />}
                      {notif.channel === 'sms' && <MessageSquare className="w-3 h-3" />}
                      {notif.channel === 'email' && <Mail className="w-3 h-3" />}
                      {notif.channel === 'phone' && <Phone className="w-3 h-3" />}
                      <span>
                        {notif.channel === 'app' ? 'APP' : notif.channel === 'sms' ? '短信' : notif.channel === 'email' ? '邮件' : '电话'}
                      </span>
                    </div>
                    <span>{formatRelativeTime(notif.sentAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLogs && (
        <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 overflow-auto">
          <h3 className="text-lg font-semibold text-white mb-4">历史处置记录</h3>
          {logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        log.type === 'weather' && 'bg-blue-500/20',
                        log.type === 'equipment' && 'bg-amber-500/20',
                        log.type === 'security' && 'bg-red-500/20',
                      )}>
                        {log.type === 'weather' && <CloudRain className="w-5 h-5 text-blue-400" />}
                        {log.type === 'equipment' && <Wrench className="w-5 h-5 text-amber-400" />}
                        {log.type === 'security' && <ShieldAlert className="w-5 h-5 text-red-400" />}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{log.planName}</h4>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(log.triggeredAt)} · {log.triggeredBy}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      log.status === 'resolved' && 'bg-green-500/20 text-green-400',
                      log.status === 'in_progress' && 'bg-amber-500/20 text-amber-400',
                      log.status === 'triggered' && 'bg-red-500/20 text-red-400',
                    )}>
                      {log.status === 'resolved' ? '已解除' : log.status === 'in_progress' ? '处置中' : '已触发'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暂无处置记录</p>
            </div>
          )}
        </div>
      )}

      {!isEmergencyActive && !showLogs && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-slate-500 text-lg">当前无应急事件</p>
            <p className="text-slate-600 text-sm mt-1">选择上方预案卡片一键触发应急响应</p>
          </div>
        </div>
      )}
    </div>
  );
}

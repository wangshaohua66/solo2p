import { useState, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  MapPin, 
  Clock, 
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Users,
  Settings
} from 'lucide-react';
import { useEventStore } from '@/store/useEventStore';
import { useScheduleStore } from '@/store/useScheduleStore';
import { useVenueStore } from '@/store/useVenueStore';
import { eventTypeNames, eventTypeColors } from '@/mock';
import { cn, getEventTypeColor } from '@/utils/helpers';
import { formatDateTime, formatMoney } from '@/utils/dateUtils';

export function EventWizard() {
  const { 
    wizardOpen, 
    currentStep, 
    formData, 
    setCurrentStep, 
    setFormData, 
    setWizardOpen,
    submitEvent,
    resetForm,
  } = useEventStore();
  const { checkConflicts, conflictResult } = useScheduleStore();
  const { venues, resources } = useVenueStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { id: 0, name: '基本信息', icon: FileText },
    { id: 1, name: '资源需求', icon: Settings },
    { id: 2, name: '时间安排', icon: Calendar },
    { id: 3, name: '确认提交', icon: CheckCircle2 },
  ];

  const venueResources = resources.filter(r => r.venueId === formData.venueId);

  useEffect(() => {
    if (formData.venueId && formData.startDate && formData.endDate) {
      const timer = setTimeout(() => {
        checkConflicts(formData);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [formData.venueId, formData.startDate, formData.endDate, formData.requiredResources]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await submitEvent();
    setIsSubmitting(false);
    resetForm();
  };

  const handleClose = () => {
    setWizardOpen(false);
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const toggleResource = (resourceId: string) => {
    const current = formData.requiredResources || [];
    const updated = current.includes(resourceId)
      ? current.filter(id => id !== resourceId)
      : [...current, resourceId];
    setFormData({ requiredResources: updated });
  };

  if (!wizardOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-white">新建赛事申报</h2>
            <p className="text-sm text-slate-400 mt-0.5">填写赛事信息，提交后进入审批流程</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                      isActive && 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400',
                      isCompleted && 'bg-green-500/20 border-2 border-green-500 text-green-400',
                      !isActive && !isCompleted && 'bg-slate-800 border-2 border-slate-600 text-slate-500'
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={cn(
                      'text-xs mt-2 font-medium',
                      isActive ? 'text-cyan-400' : isCompleted ? 'text-green-400' : 'text-slate-500'
                    )}>
                      {step.name}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={cn(
                      'flex-1 h-0.5 mx-2 -mt-6',
                      isCompleted ? 'bg-green-500/50' : 'bg-slate-700'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 0 && (
            <StepBasicInfo 
              formData={formData} 
              setFormData={setFormData}
              venues={venues}
            />
          )}
          {currentStep === 1 && (
            <StepResources 
              formData={formData}
              resources={venueResources}
              onToggle={toggleResource}
            />
          )}
          {currentStep === 2 && (
            <StepSchedule 
              formData={formData}
              setFormData={setFormData}
              conflictResult={conflictResult}
              resources={venueResources}
            />
          )}
          {currentStep === 3 && (
            <StepConfirm 
              formData={formData}
              venues={venues}
              resources={venueResources}
              conflictResult={conflictResult}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between bg-slate-800/30">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              currentStep === 0 
                ? 'text-slate-600 cursor-not-allowed' 
                : 'text-slate-300 hover:bg-slate-700/50'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              取消
            </button>
            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || conflictResult?.hasConflict}
                className={cn(
                  'flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all',
                  isSubmitting || conflictResult?.hasConflict
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                )}
              >
                {isSubmitting ? '提交中...' : '提交申报'}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-sm font-medium hover:bg-cyan-500/30 transition-colors"
              >
                下一步
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBasicInfo({ formData, setFormData, venues }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            赛事名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ name: e.target.value })}
            placeholder="请输入赛事名称"
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            赛事类型 <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.type || 'football'}
            onChange={(e) => setFormData({ type: e.target.value as any })}
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
          >
            {Object.entries(eventTypeNames).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            举办场馆 <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.venueId || ''}
            onChange={(e) => setFormData({ venueId: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
          >
            <option value="">请选择场馆</option>
            {venues.map((v: any) => (
              <option key={v.id} value={v.id}>{v.name}（{v.capacity.toLocaleString()}人）</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            主办单位
          </label>
          <input
            type="text"
            value={formData.organizer || ''}
            onChange={(e) => setFormData({ organizer: e.target.value })}
            placeholder="请输入主办单位"
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            预计营收（元）
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="number"
              value={formData.expectedRevenue || ''}
              onChange={(e) => setFormData({ expectedRevenue: Number(e.target.value) })}
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            设备模式
          </label>
          <div className="flex gap-4">
            {['sports', 'concert'].map((mode) => (
              <button
                key={mode}
                onClick={() => setFormData({ equipmentMode: mode as any })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all',
                  formData.equipmentMode === mode
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600'
                )}
              >
                <Settings className="w-5 h-5" />
                {mode === 'sports' ? '体育赛事模式' : '演唱会模式'}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            赛事介绍
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ description: e.target.value })}
            placeholder="请简要描述赛事内容、规模、注意事项等"
            rows={4}
            className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
          />
        </div>
      </div>
    </div>
  );
}

function StepResources({ formData, resources, onToggle }: any) {
  const categories = resources.reduce((acc: any, r: any) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-cyan-400 font-medium text-sm">资源选择提示</p>
            <p className="text-cyan-300/70 text-sm mt-1">
              已选择 {(formData.requiredResources || []).length} 项资源，系统将根据资源清单自动计算转换时间和可用性
            </p>
          </div>
        </div>
      </div>

      {Object.entries(categories).map(([category, categoryResources]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">{category}</h3>
          <div className="grid grid-cols-2 gap-3">
            {(categoryResources as any[]).map((resource: any) => {
              const isSelected = (formData.requiredResources || []).includes(resource.id);
              const isAvailable = resource.status === 'available';

              return (
                <button
                  key={resource.id}
                  onClick={() => isAvailable && onToggle(resource.id)}
                  disabled={!isAvailable}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : isAvailable
                      ? 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                      : 'bg-slate-800/20 border-slate-700/30 opacity-50 cursor-not-allowed'
                  )}
                >
                  <div 
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                      isSelected 
                        ? 'bg-cyan-500 border-cyan-500' 
                        : 'border-slate-500'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{resource.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        isAvailable ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                      )}>
                        {isAvailable ? '可用' : '占用中'}
                      </span>
                      {resource.conversionTime > 0 && (
                        <span className="text-xs text-slate-500">
                          转换 {resource.conversionTime}分钟
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepSchedule({ formData, setFormData, conflictResult, resources }: any) {
  return (
    <div className="space-y-6">
      {conflictResult && conflictResult.hasConflict && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-medium text-sm">检测到档期冲突</p>
              <p className="text-red-300/70 text-sm mt-1">
                共 {conflictResult.conflicts.length} 处冲突，请调整时间或查看推荐方案
              </p>
              <div className="mt-2 space-y-1">
                {conflictResult.conflicts.slice(0, 3).map((c: any, i: number) => (
                  <p key={i} className="text-xs text-red-300/70">
                    · {c.description}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {conflictResult && conflictResult.suggestions.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-400 font-medium text-sm">推荐替代方案</p>
              <div className="mt-2 space-y-2">
                {conflictResult.suggestions.slice(0, 3).map((s: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      setFormData({ 
                        startDate: new Date(s.alternativeDate),
                        requiredResources: s.alternativeResources,
                      });
                    }}
                    className="w-full flex items-center justify-between p-2 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors text-left"
                  >
                    <span className="text-sm text-amber-300">
                      {formatDateTime(s.alternativeDate)}
                    </span>
                    <span className="text-xs text-amber-400">{s.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            开始时间 <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="datetime-local"
              value={formData.startDate ? new Date(formData.startDate).toISOString().slice(0, 16) : ''}
              onChange={(e) => setFormData({ startDate: new Date(e.target.value) })}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            结束时间 <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="datetime-local"
              value={formData.endDate ? new Date(formData.endDate).toISOString().slice(0, 16) : ''}
              onChange={(e) => setFormData({ endDate: new Date(e.target.value) })}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">时间统计</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-400">
              {formData.startDate && formData.endDate
                ? Math.max(1, Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60)))
                : 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">预计时长（小时）</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">
              {(formData.requiredResources || []).reduce((total: number, id: string) => {
                const r = resources.find((res: any) => res.id === id);
                return total + (r?.conversionTime || 0);
              }, 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">设备转换（分钟）</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {conflictResult ? conflictResult.detectionTime.toFixed(0) : 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">冲突检测（毫秒）</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">审批流程预览</h3>
        <div className="flex items-center justify-between">
          {['调度员初审', '运营经理复审', '财务核价'].map((step, idx) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm font-medium">
                  {idx + 1}
                </div>
                <span className="text-xs text-slate-500 mt-1">{step}</span>
              </div>
              {idx < 2 && <div className="flex-1 h-0.5 bg-slate-700 mx-2" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepConfirm({ formData, venues, resources, conflictResult }: any) {
  const venue = venues.find((v: any) => v.id === formData.venueId);
  const selectedResources = resources.filter((r: any) => 
    (formData.requiredResources || []).includes(r.id)
  );
  const color = getEventTypeColor(formData.type);

  return (
    <div className="space-y-6">
      {!conflictResult?.hasConflict && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">档期检查通过</p>
              <p className="text-green-300/70 text-sm">未检测到档期冲突，可以提交申报</p>
            </div>
          </div>
        </div>
      )}

      <div 
        className="rounded-xl p-5 border"
        style={{ 
          background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
          borderColor: `${color}30`,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${color}25`, color }}
              >
                {eventTypeNames[formData.type as keyof typeof eventTypeNames]}
              </span>
              <span className="text-slate-400 text-sm">
                {formData.equipmentMode === 'sports' ? '体育模式' : '演唱会模式'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">{formData.name || '未命名赛事'}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <MapPin className="w-4 h-4" />
            <span className="text-xs">举办场馆</span>
          </div>
          <p className="text-white font-medium">{venue?.name || '未选择'}</p>
        </div>

        <div className="bg-slate-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">预计营收</span>
          </div>
          <p className="text-green-400 font-bold text-lg">
            {formatMoney(formData.expectedRevenue || 0)}
          </p>
        </div>

        <div className="bg-slate-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">开始时间</span>
          </div>
          <p className="text-white text-sm">
            {formData.startDate ? formatDateTime(formData.startDate) : '未设置'}
          </p>
        </div>

        <div className="bg-slate-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs">结束时间</span>
          </div>
          <p className="text-white text-sm">
            {formData.endDate ? formatDateTime(formData.endDate) : '未设置'}
          </p>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">所需资源</span>
          <span className="text-xs text-slate-500">共 {selectedResources.length} 项</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedResources.map((r: any) => (
            <span 
              key={r.id}
              className="px-2 py-1 bg-slate-700/50 rounded-md text-xs text-slate-300"
            >
              {r.name}
            </span>
          ))}
          {selectedResources.length === 0 && (
            <span className="text-slate-500 text-sm">未选择资源</span>
          )}
        </div>
      </div>

      {formData.organizer && (
        <div className="bg-slate-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs">主办单位</span>
          </div>
          <p className="text-white text-sm">{formData.organizer}</p>
        </div>
      )}

      {formData.description && (
        <div className="bg-slate-800/40 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-2">赛事介绍</span>
          <p className="text-sm text-slate-300 leading-relaxed">{formData.description}</p>
        </div>
      )}

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">提交须知</p>
            <ul className="text-amber-300/70 text-sm mt-1 space-y-1">
              <li>· 提交后将进入三级审批流程，预计 1-3 个工作日完成</li>
              <li>· 审批通过后档期将锁定 7 天，逾期未确认自动释放</li>
              <li>· 如需修改，请在审批前撤回或联系调度员</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

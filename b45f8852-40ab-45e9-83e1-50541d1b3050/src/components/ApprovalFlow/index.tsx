import { useState } from 'react';
import {
  Steps,
  Timeline,
  Avatar,
  Button,
  Input,
  Modal,
  message,
  Tag,
  Space,
  Tooltip,
  Divider,
} from 'antd';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  ThumbsUp,
  ThumbsDown,
  FileEdit,
  AlertTriangle,
  User,
  Clock,
  MessageSquare,
} from 'lucide-react';
import type { StepsProps } from 'antd';
import type { MaintenanceTask, ApprovalStatus, ApprovalEntry } from '@/types';
import { usePlanStore } from '@/store/planStore';

const { TextArea } = Input;

const STATUS_STEP_MAP: Record<ApprovalStatus, number> = {
  draft: 0,
  submitted: 1,
  reviewing: 2,
  approved: 3,
  completed: 4,
  rejected: 0,
};

const STEP_TITLES = ['草稿', '已提交', '审核中', '已批准', '已完成'];

const ACTION_NAME_MAP: Record<ApprovalEntry['action'], string> = {
  submit: '提交审核',
  review_pass: '审核通过',
  review_reject: '审核驳回',
  approve: '批准通过',
  approve_reject: '批准驳回',
  withdraw: '撤回申请',
};

const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-gradient-to-br from-dispatch-400 to-dispatch-600',
    'bg-gradient-to-br from-emerald-400 to-emerald-600',
    'bg-gradient-to-br from-amber-400 to-amber-600',
    'bg-gradient-to-br from-rose-400 to-rose-600',
    'bg-gradient-to-br from-sky-400 to-sky-600',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};

interface ApprovalFlowProps {
  task: MaintenanceTask;
  currentRole?: 'applicant' | 'reviewer' | 'approver';
}

const ApprovalFlow = ({ task, currentRole = 'applicant' }: ApprovalFlowProps) => {
  const approve = usePlanStore((s) => s.approve);
  const reject = usePlanStore((s) => s.reject);
  const submitForApproval = usePlanStore((s) => s.submitForApproval);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectTargetRole, setRejectTargetRole] = useState<'reviewer' | 'approver'>('reviewer');

  const isRejected = task.approvalStatus === 'rejected';
  const currentStep = isRejected ? 0 : STATUS_STEP_MAP[task.approvalStatus];

  const getStepIcon = (idx: number) => {
    if (isRejected && idx === 0) {
      return <XCircle size={20} className="text-red-500" />;
    }
    if (idx < currentStep) {
      return <CheckCircle2 size={20} className="text-emerald-500" />;
    }
    if (idx === currentStep) {
      if (task.approvalStatus === 'submitted' || task.approvalStatus === 'reviewing') {
        return <Loader2 size={20} className="text-dispatch-600 animate-spin" />;
      }
      return <CheckCircle2 size={20} className="text-dispatch-600" />;
    }
    return <div className="w-5 h-5 rounded-full border-2 border-slate-300" />;
  };

  const stepItems: StepsProps['items'] = STEP_TITLES.map((title, idx) => ({
    title,
    icon: getStepIcon(idx),
    status:
      idx < currentStep
        ? 'finish'
        : idx === currentStep
        ? isRejected && idx === 0
          ? 'error'
          : 'process'
        : 'wait',
  }));

  const rejectLogEntry = task.approvalLog.find(
    (l) => l.action === 'review_reject' || l.action === 'approve_reject'
  );

  const handleSubmit = () => {
    submitForApproval(task.id);
    message.success('已提交审核');
  };

  const handleReviewPass = () => {
    approve(task.id, 'reviewer');
    message.success('审核已通过');
  };

  const handleApprove = () => {
    approve(task.id, 'approver');
    message.success('已批准执行');
  };

  const openRejectModal = (role: 'reviewer' | 'approver') => {
    setRejectTargetRole(role);
    setRejectComment('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = () => {
    if (!rejectComment.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    reject(task.id, rejectComment.trim(), rejectTargetRole);
    setShowRejectModal(false);
    message.success('已驳回');
  };

  const getActionButtons = () => {
    const btnStyle = '!h-10 !px-5 !text-sm font-medium';
    switch (task.approvalStatus) {
      case 'draft':
        return currentRole === 'applicant' ? (
          <Button
            type="primary"
            icon={<Send size={16} />}
            onClick={handleSubmit}
            className={btnStyle}
          >
            提交审核
          </Button>
        ) : null;

      case 'submitted':
      case 'rejected':
        if (currentRole === 'reviewer') {
          return (
            <Space size="middle">
              <Button
                type="primary"
                icon={<ThumbsUp size={16} />}
                onClick={handleReviewPass}
                className={btnStyle}
              >
                审核通过
              </Button>
              <Button
                danger
                icon={<ThumbsDown size={16} />}
                onClick={() => openRejectModal('reviewer')}
                className={btnStyle}
              >
                审核驳回
              </Button>
            </Space>
          );
        }
        if (currentRole === 'applicant' && task.approvalStatus === 'rejected') {
          return (
            <Button
              type="primary"
              icon={<FileEdit size={16} />}
              onClick={handleSubmit}
              className={btnStyle}
            >
              重新提交
            </Button>
          );
        }
        return null;

      case 'reviewing':
        if (currentRole === 'approver') {
          return (
            <Space size="middle">
              <Button
                type="primary"
                icon={<ThumbsUp size={16} />}
                onClick={handleApprove}
                className={btnStyle}
              >
                批准执行
              </Button>
              <Button
                danger
                icon={<ThumbsDown size={16} />}
                onClick={() => openRejectModal('approver')}
                className={btnStyle}
              >
                不予批准
              </Button>
            </Space>
          );
        }
        return null;

      default:
        return null;
    }
  };

  const getTimelineColor = (action: ApprovalEntry['action']) => {
    if (action.endsWith('_reject')) return 'red';
    if (action === 'approve') return 'blue';
    if (action === 'review_pass') return 'green';
    return 'blue';
  };

  const getTimelineDot = (action: ApprovalEntry['action']) => {
    const colorMap: Record<string, string> = {
      submit: 'bg-dispatch-500',
      review_pass: 'bg-emerald-500',
      review_reject: 'bg-red-500',
      approve: 'bg-blue-600',
      approve_reject: 'bg-red-500',
      withdraw: 'bg-slate-400',
    };
    return (
      <div
        className={`w-3 h-3 rounded-full ${colorMap[action] || 'bg-slate-400'}`}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="px-2 pt-2">
        <Steps
          current={currentStep}
          items={stepItems}
          size="small"
          className="!mb-2"
        />
      </div>

      {isRejected && rejectLogEntry && (
        <div className="mx-2">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-red-700">
                    申请被驳回
                  </span>
                  <Tag color="red" bordered={false}>
                    驳回人：{rejectLogEntry.operatorName}
                  </Tag>
                  <span className="text-xs text-red-400 inline-flex items-center gap-1">
                    <Clock size={11} />
                    {formatDateTime(rejectLogEntry.operatedAt)}
                  </span>
                </div>
                {rejectLogEntry.comment && (
                  <div className="text-sm text-red-600 leading-relaxed bg-white/60 rounded-lg p-3 border border-red-100">
                    <div className="flex items-start gap-2">
                      <MessageSquare size={13} className="mt-0.5 flex-shrink-0" />
                      <span>{rejectLogEntry.comment}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Divider className="!my-2" plain>
        <span className="text-xs text-slate-400 font-medium">审批日志</span>
      </Divider>

      <div className="px-2 max-h-80 overflow-y-auto scrollbar-thin pr-2">
        {task.approvalLog.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            <Clock size={36} className="mx-auto mb-3 opacity-50" />
            <div>暂无审批记录</div>
          </div>
        ) : (
          <Timeline
            mode="left"
            items={[...task.approvalLog]
              .sort((a, b) => a.operatedAt - b.operatedAt)
              .map((log) => ({
                color: getTimelineColor(log.action),
                dot: getTimelineDot(log.action),
                label: (
                  <div className="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                    <Clock size={11} />
                    {formatDateTime(log.operatedAt)}
                  </div>
                ),
                children: (
                  <div className="pb-4">
                    <div className="flex items-start gap-3">
                      <Avatar
                        size={32}
                        className={`${getAvatarColor(log.operatorName)} flex items-center justify-center text-white text-sm font-medium`}
                        icon={<User size={14} />}
                      >
                        {log.operatorName.charAt(0)}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800">
                            {log.operatorName}
                          </span>
                          <Tag
                            color={
                              log.action.endsWith('_reject')
                                ? 'red'
                                : log.action === 'approve'
                                ? 'blue'
                                : log.action === 'review_pass'
                                ? 'green'
                                : 'geekblue'
                            }
                            bordered={false}
                            className="!text-xs !py-0 !h-5 !leading-5"
                          >
                            {ACTION_NAME_MAP[log.action]}
                          </Tag>
                          {log.role && (
                            <span className="text-xs text-slate-400">
                              （{log.role === 'reviewer' ? '专责审核' : '调度批准'}）
                            </span>
                          )}
                        </div>
                        {log.comment && (
                          <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                            {log.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ),
              }))}
          />
        )}
      </div>

      {getActionButtons() && (
        <>
          <Divider className="!my-2" />
          <div className="flex justify-end px-2 pb-2">{getActionButtons()}</div>
        </>
      )}

      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <ThumbsDown size={18} className="text-red-500" />
            {rejectTargetRole === 'reviewer' ? '审核驳回' : '不予批准'}
          </span>
        }
        open={showRejectModal}
        onOk={handleConfirmReject}
        onCancel={() => setShowRejectModal(false)}
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={480}
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-600">请输入驳回原因：</div>
          <TextArea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="请详细说明驳回原因，便于申请人修改..."
            rows={4}
            maxLength={500}
            showCount
          />
          <div className="text-xs text-slate-400">
            <Tooltip title="驳回后申请人可根据原因修改后重新提交">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-500" />
                驳回后申请人可根据原因修改后重新提交
              </span>
            </Tooltip>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalFlow;

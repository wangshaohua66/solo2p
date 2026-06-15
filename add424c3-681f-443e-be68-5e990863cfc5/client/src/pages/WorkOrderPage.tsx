import { useEffect, useState } from 'react';
import { useWorkOrderStore } from '@/stores/workorderStore';
import { useDisorderStore } from '@/stores/disorderStore';
import { Plus, RefreshCw, Check, X, ChevronRight, Users } from 'lucide-react';
import { WorkOrderStatus, DisorderType, Severity } from '@/types';
import type { CreateWorkOrderParams } from '@/services/api';
import type { WorkOrder } from '@/types';
import styles from './WorkOrderPage.module.css';

const KANBAN_COLUMNS = [
  { status: WorkOrderStatus.Pending, title: '待派发', colorClass: styles.columnPending },
  { status: WorkOrderStatus.Assigned, title: '已指派', colorClass: styles.columnAssigned },
  { status: WorkOrderStatus.Repairing, title: '修复中', colorClass: styles.columnRepairing },
  { status: WorkOrderStatus.Accepting, title: '待验收', colorClass: styles.columnAccepting },
  { status: WorkOrderStatus.Closed, title: '已闭环', colorClass: styles.columnClosed }
];

export default function WorkOrderPage() {
  const {
    workOrders,
    notifications,
    loading,
    fetchWorkOrders,
    createWorkOrder,
    updateStatus,
    updateProgress,
    fetchTeamRecommendations,
    teamRecommendations,
    markNotificationsRead
  } = useWorkOrderStore();

  const { disorders, fetchDisorders } = useDisorderStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDisorderId, setSelectedDisorderId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [bouncingCardId, setBouncingCardId] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkOrders();
    fetchDisorders();
  }, [fetchWorkOrders, fetchDisorders]);

  const handleFetchRecommendations = async (disorderId: string) => {
    setSelectedDisorderId(disorderId);
    setSelectedTeamId('');
    await fetchTeamRecommendations(disorderId);
  };

  const handleCreateWorkOrder = async () => {
    if (!selectedDisorderId || !selectedTeamId || !deadline || !assigneeId) return;
    const data: CreateWorkOrderParams = {
      disorderId: selectedDisorderId,
      teamId: selectedTeamId,
      assigneeId,
      deadline
    };
    await createWorkOrder(data);
    setShowCreateModal(false);
    setSelectedDisorderId('');
    setSelectedTeamId('');
    setDeadline('');
    setAssigneeId('');
  };

  const getDisorderTypeText = (type: DisorderType) => {
    const map: Record<DisorderType, string> = {
      [DisorderType.Pothole]: '坑槽',
      [DisorderType.Crack]: '裂缝',
      [DisorderType.Rutting]: '车辙',
      [DisorderType.BridgeJump]: '桥头跳车',
      [DisorderType.Other]: '其他'
    };
    return map[type];
  };

  const getSeverityText = (severity: Severity) => {
    const map: Record<Severity, string> = {
      [Severity.Mild]: '轻微',
      [Severity.Moderate]: '中等',
      [Severity.Severe]: '严重',
      [Severity.Critical]: '危急'
    };
    return map[severity];
  };

  const getPriorityClass = (severity: Severity) => {
    const map: Record<Severity, string> = {
      [Severity.Mild]: styles.priorityMild,
      [Severity.Moderate]: styles.priorityModerate,
      [Severity.Severe]: styles.prioritySevere,
      [Severity.Critical]: styles.priorityCritical
    };
    return map[severity];
  };

  const getWorkOrdersByStatus = (status: WorkOrderStatus) => {
    return workOrders.filter((order) => order.status === status);
  };

  const isUrgent = (deadlineStr: string) => {
    const deadlineDate = new Date(deadlineStr);
    const now = new Date();
    const diff = deadlineDate.getTime() - now.getTime();
    return diff < 24 * 60 * 60 * 1000;
  };

  const handleCardAction = async (
    orderId: string,
    action: 'assign' | 'progress' | 'accept'
  ) => {
    setBouncingCardId(orderId);
    setTimeout(() => setBouncingCardId(null), 500);

    if (action === 'assign') {
      await updateStatus(orderId, WorkOrderStatus.Assigned);
    } else if (action === 'progress') {
      const order = workOrders.find((o) => o.id === orderId);
      if (order) {
        if (order.progress < 100) {
          await updateProgress(orderId, Math.min(100, order.progress + 10));
        }
        if (order.progress + 10 >= 100) {
          await updateStatus(orderId, WorkOrderStatus.Accepting);
        }
      }
    } else if (action === 'accept') {
      await updateStatus(orderId, WorkOrderStatus.Closed);
    }
  };

  const renderWorkOrderCard = (order: WorkOrder) => {
    const isBouncing = bouncingCardId === order.id;
    const urgent = isUrgent(order.deadline);

    return (
      <div
        key={order.id}
        className={`${styles.workOrderCard} ${isBouncing ? styles.cardBouncing : ''}`}
      >
        <div className={styles.stakeNumber}>#{order.id}</div>
        <div className={styles.disorderType}>
          {order.disorder && (
            <>
              {getDisorderTypeText(order.disorder.type)} -{' '}
              {getSeverityText(order.disorder.severity)}
            </>
          )}
        </div>
        <div className={styles.cardMeta}>
          <span
            className={`${styles.priorityTag} ${
              order.disorder ? getPriorityClass(order.disorder.severity) : ''
            }`}
          >
            {order.disorder ? getSeverityText(order.disorder.severity) : '中'}级
          </span>
          <span className={`${styles.countdown} ${urgent ? styles.countdownUrgent : ''}`}>
            {order.deadline}
          </span>
        </div>
        <div className={styles.teamInfo}>
          <Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {order.team?.name || '未指派'}
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${order.progress}%` }}
          />
        </div>
        <div className={styles.progressValue}>{order.progress}%</div>
        <div className={styles.cardActions}>
          {order.status === WorkOrderStatus.Pending && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => handleCardAction(order.id, 'assign')}
            >
              <Check size={12} />
              派发
            </button>
          )}
          {(order.status === WorkOrderStatus.Assigned ||
            order.status === WorkOrderStatus.Repairing) && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
              onClick={() => handleCardAction(order.id, 'progress')}
            >
              +10%
            </button>
          )}
          {order.status === WorkOrderStatus.Accepting && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
              onClick={() => handleCardAction(order.id, 'accept')}
            >
              <Check size={12} />
              验收
            </button>
          )}
          <button className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h3>工单看板</h3>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            创建工单
          </button>
          <button className="btn" onClick={() => fetchWorkOrders()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            刷新
          </button>
        </div>
      </div>

      <div className={styles.kanban}>
        {KANBAN_COLUMNS.map((column) => {
          const columnOrders = getWorkOrdersByStatus(column.status);
          return (
            <div key={column.status} className={styles.kanbanColumn}>
              <div
                className={`${styles.columnHeader} ${column.colorClass}`}
              >
                <span className={styles.columnTitle}>{column.title}</span>
                <span className={styles.columnCount}>{columnOrders.length}</span>
              </div>
              {columnOrders.map(renderWorkOrderCard)}
              {columnOrders.length === 0 && (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  暂无工单
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`card ${styles.notificationSection}`}>
        <div className="card-header">
          <h3>通知消息</h3>
          <button className="btn btn-small" onClick={markNotificationsRead}>
            <X size={14} />
            全部已读
          </button>
        </div>
        <div className={styles.notificationList}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`${styles.notificationItem} ${notif.read ? styles.notificationItemRead : styles.notificationItemUnread}`}
              onClick={() => markNotificationsRead()}
            >
              <div className={styles.notificationTitle}>{notif.title}</div>
              <div className={styles.notificationContent}>{notif.content}</div>
              <div className={styles.notificationTime}>{notif.createdAt}</div>
            </div>
          ))}
          {notifications.length === 0 && <div className="empty-state">暂无通知</div>}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className={styles.recommendModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>创建工单</h3>
              <button
                className={styles.modalClose}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="form-group">
              <label>选择病害</label>
              <select
                value={selectedDisorderId}
                onChange={(e) => handleFetchRecommendations(e.target.value)}
              >
                <option value="">请选择病害</option>
                {disorders.map((d) => (
                  <option key={d.id} value={d.id}>
                    {getDisorderTypeText(d.type)} - {d.id}
                  </option>
                ))}
              </select>
            </div>
            {teamRecommendations.length > 0 && (
              <div className="form-group">
                <label>推荐施工队</label>
                <div className={styles.teamList}>
                  {teamRecommendations.map((team) => (
                    <div
                      key={team.teamId}
                      className={`${styles.teamItem} ${
                        selectedTeamId === team.teamId ? styles.teamItemSelected : ''
                      }`}
                      onClick={() => setSelectedTeamId(team.teamId)}
                    >
                      <div>
                        <div className={styles.teamName}>{team.teamName}</div>
                        <div className={styles.teamMeta}>
                          <span>距离: {team.distance.toFixed(1)}km</span>
                          <span>工作负载: {team.workload}</span>
                        </div>
                      </div>
                      <span className={styles.scoreBadge}>
                        {team.score.toFixed(0)}分
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group">
              <label>负责人ID</label>
              <input
                type="text"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                placeholder="请输入负责人ID"
              />
            </div>
            <div className="form-group">
              <label>截止日期</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreateModal(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateWorkOrder}
                disabled={loading}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

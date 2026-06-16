import React, { useState, useCallback, useMemo } from 'react';
import { Button, Empty, Tag, Space, Card, List, Tooltip, Modal, Form, Select, Input, message, Alert } from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DragOutlined,
  TeamOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import {
  DISPATCH_STATUS_MAP,
  DISPATCH_STATUS_COLOR,
  PRIORITY_MAP,
  PRIORITY_COLOR,
  TEAM_STATUS_MAP,
  TEAM_STATUS_COLOR,
} from '@/constants/dictionary';
import {
  generateDispatchPlan,
  approveDispatchPlan,
  cancelDispatchPlan,
  reassignTeam,
  checkDispatchConflicts,
} from '@/api/dispatch';
import { DispatchPlan, RescueTeam, TeamAssignment } from '@/types';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface DragItem {
  type: 'assignment' | 'team';
  assignment?: TeamAssignment;
  team?: RescueTeam;
  sourcePlanId?: number;
}

const DispatchPanel: React.FC = () => {
  const { currentIncident, dispatchPlans, setDispatchPlans, teams } = useCommandStore();
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverPlanId, setDragOverPlanId] = useState<number | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<number | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<TeamAssignment | null>(null);
  const [conflictInfo, setConflictInfo] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [form] = Form.useForm();

  const availableTeams = useMemo(() => teams.filter((t) => t.status === 1), [teams]);
  const busyTeams = useMemo(() => teams.filter((t) => t.status === 2 || t.status === 3), [teams]);

  const filteredPlans = currentIncident
    ? dispatchPlans.filter((p) => p.incidentId === currentIncident.id)
    : dispatchPlans;

  const displayPlans = filteredPlans.length > 0 ? filteredPlans : dispatchPlans.slice(0, 5);

  const handleGeneratePlan = async (values: any) => {
    try {
      if (values.teamIds && values.teamIds.length > 0) {
        const conflictResult = await checkDispatchConflicts(currentIncident!.id, values.teamIds);
        if (conflictResult && conflictResult.hasConflicts) {
          setConflictInfo(conflictResult);
          return;
        }
      }

      const plan = await generateDispatchPlan({
        incidentId: currentIncident!.id,
        ...values,
      });
      message.success('调度方案生成成功');
      setShowGenerateModal(false);
      setConflictInfo(null);
      form.resetFields();
      setDispatchPlans([plan as unknown as DispatchPlan, ...dispatchPlans]);
    } catch (error) {
      message.error('方案生成失败');
    }
  };

  const handleApprove = async (plan: DispatchPlan, action: number) => {
    try {
      await approveDispatchPlan(plan.id, action, action === 2 ? '同意调度' : '调度请求被驳回');
      message.success(action === 2 ? '已批准调度' : '已驳回调度');
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCancel = async (plan: DispatchPlan) => {
    Modal.confirm({
      title: '取消调度',
      icon: <ExclamationCircleOutlined />,
      content: `确定要取消调度方案【${plan.title}】吗？此操作将召回所有已分配的队伍。`,
      okText: '确定取消',
      cancelText: '保留',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelDispatchPlan(plan.id, '用户取消');
          message.success('调度已取消');
        } catch (error) {
          message.error('取消失败');
        }
      },
    });
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: DragItem) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(item));
      setDraggedItem(item);
      setIsDragging(true);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverPlanId(null);
    setDragOverTeamId(null);
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, planId?: number, teamId?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (planId) setDragOverPlanId(planId);
    if (teamId) setDragOverTeamId(teamId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPlanId(null);
    setDragOverTeamId(null);
  }, []);

  const handleDropOnPlan = useCallback(
    async (e: React.DragEvent, targetPlan: DispatchPlan) => {
      e.preventDefault();
      handleDragLeave();

      if (!draggedItem) return;

      try {
        if (draggedItem.type === 'assignment') {
          const sourceAssignment = draggedItem.assignment;
          if (!sourceAssignment || draggedItem.sourcePlanId === targetPlan.id) {
            message.warning('不能移动到同一调度方案');
            return;
          }

          Modal.confirm({
            title: '移动队伍分配',
            content: `确定要将【${sourceAssignment.teamName}】从原调度方案移动到【${targetPlan.title}】吗？`,
            okText: '确定移动',
            cancelText: '取消',
            onOk: async () => {
              await reassignTeam(sourceAssignment.id, sourceAssignment.teamId, `移动到调度方案: ${targetPlan.title}`);
              message.success('队伍已移动到新的调度方案');
            },
          });
        } else if (draggedItem.type === 'team' && draggedItem.team) {
          const team = draggedItem.team;
          Modal.confirm({
            title: '添加队伍到调度方案',
            content: `确定要将【${team.teamName}】（${team.teamSize}人）添加到【${targetPlan.title}】吗？`,
            okText: '确定添加',
            cancelText: '取消',
            onOk: async () => {
              await reassignTeam(0, team.id, `添加到调度方案: ${targetPlan.title}`);
              message.success('队伍已添加到调度方案');
            },
          });
        }
      } catch (error) {
        message.error('操作失败');
      }
    },
    [draggedItem, handleDragLeave]
  );

  const handleDropOnTeam = useCallback(
    async (e: React.DragEvent, targetTeam: RescueTeam) => {
      e.preventDefault();
      handleDragLeave();

      if (!draggedItem || draggedItem.type !== 'assignment') return;

      const sourceAssignment = draggedItem.assignment;
      if (!sourceAssignment) return;

      if (sourceAssignment.teamId === targetTeam.id) {
        message.warning('不能替换为同一支队伍');
        return;
      }

      if (targetTeam.status !== 1) {
        message.warning('该队伍当前不可用');
        return;
      }

      Modal.confirm({
        title: '替换救援队伍',
        content: (
          <div>
            <p>原队伍：<Tag>{sourceAssignment.teamName}</Tag></p>
            <p>替换为：<Tag color={TEAM_STATUS_COLOR[targetTeam.status]}>{targetTeam.teamName}</Tag>（{targetTeam.teamSize}人）</p>
            <p style={{ marginTop: 8 }}>确定要执行此替换操作吗？</p>
          </div>
        ),
        okText: '确认替换',
        cancelText: '取消',
        onOk: async () => {
          try {
            await reassignTeam(sourceAssignment.id, targetTeam.id, '拖拽替换队伍');
            message.success('队伍替换成功');
            setSelectedAssignment(null);
          } catch (error) {
            message.error('替换失败');
          }
        },
      });
    },
    [draggedItem, handleDragLeave]
  );

  const handleDropOnAvailableArea = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      handleDragLeave();

      if (!draggedItem || draggedItem.type !== 'assignment') return;

      const assignment = draggedItem.assignment;
      if (!assignment) return;

      Modal.confirm({
        title: '移除队伍分配',
        content: `确定要从调度方案中移除【${assignment.teamName}】吗？`,
        okText: '确定移除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await reassignTeam(assignment.id, 0, '从调度方案中移除');
            message.success('队伍已移除');
          } catch (error) {
            message.error('移除失败');
          }
        },
      });
    },
    [draggedItem, handleDragLeave]
  );

  const renderTeamCard = (team: RescueTeam, isAvailable: boolean) => (
    <div
      draggable={isAvailable}
      onDragStart={(e) => isAvailable && handleDragStart(e, { type: 'team', team })}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => !isAvailable && handleDragOver(e, undefined, team.id)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDropOnTeam(e, team)}
      style={{
        padding: '10px 12px',
        marginBottom: 6,
        background: dragOverTeamId === team.id
          ? 'rgba(24, 144, 255, 0.2)'
          : 'rgba(30, 41, 59, 0.5)',
        border: `2px solid ${dragOverTeamId === team.id ? '#1890ff' : '#1e293b'}`,
        borderRadius: 6,
        cursor: isAvailable ? 'grab' : 'default',
        transition: 'all 0.2s ease',
        opacity: isAvailable && isDragging && draggedItem?.team?.id === team.id ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAvailable && <DragOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
          <span style={{ fontSize: 13 }}>{team.teamName}</span>
        </div>
        <Space size={4}>
          <Tag color={TEAM_STATUS_COLOR[team.status]} style={{ margin: 0, fontSize: 10 }}>
            {TEAM_STATUS_MAP[team.status]}
          </Tag>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            {team.teamSize}人
          </span>
        </Space>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
        {team.teamType} · 响应半径 {team.responseRadius}km
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {currentIncident && (
        <div
          style={{
            padding: 12,
            marginBottom: 12,
            background: 'rgba(24, 144, 255, 0.1)',
            border: '1px solid rgba(24, 144, 255, 0.3)',
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>当前选中灾情</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{currentIncident.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
            <span>📍 {currentIncident.location}</span>
            <span style={{ marginLeft: 12 }}>👥 {currentIncident.affectedPopulation || 0}人受灾</span>
          </div>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setShowGenerateModal(true)}
            style={{ width: '100%' }}
          >
            生成调度方案
          </Button>
        </div>
      )}

      {isDragging && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnAvailableArea}
          style={{
            padding: 16,
            marginBottom: 12,
            border: '2px dashed #52c41a',
            borderRadius: 6,
            textAlign: 'center',
            background: 'rgba(82, 196, 26, 0.05)',
            color: '#52c41a',
            fontSize: 12,
          }}
        >
          <TeamOutlined style={{ marginRight: 6 }} />
          拖拽分配卡片到此处可移除队伍
        </div>
      )}

      {availableTeams.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span><TeamOutlined style={{ marginRight: 4 }} /> 可用队伍（拖拽到调度方案）</span>
            <Tag color="#52c41a" style={{ margin: 0 }}>{availableTeams.length}支待命</Tag>
          </div>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {availableTeams.map((team) => renderTeamCard(team, true))}
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span><SwapOutlined style={{ marginRight: 4 }} /> 调度方案（拖拽卡片可重新分配队伍）</span>
        <span style={{ fontSize: 11 }}>共 {displayPlans.length} 个方案</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayPlans.length === 0 ? (
          <Empty
            description={currentIncident ? '暂无调度方案，点击上方按钮生成' : '请先选择灾情'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ color: 'rgba(255,255,255,0.45)', marginTop: 40 }}
          />
        ) : (
          <List
            dataSource={displayPlans}
            renderItem={(plan) => {
              const isDragOver = dragOverPlanId === plan.id;
              return (
                <Card
                  key={plan.id}
                  size="small"
                  style={{
                    marginBottom: 12,
                    border: `2px solid ${isDragOver ? '#1890ff' : '#1e293b'}`,
                    background: isDragOver ? 'rgba(24, 144, 255, 0.1)' : 'rgba(30, 41, 59, 0.5)',
                    transition: 'all 0.2s ease',
                  }}
                  onDragOver={(e) => handleDragOver(e, plan.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnPlan(e, plan)}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {isDragOver && <DragOutlined style={{ marginRight: 6, color: '#1890ff' }} />}
                        {plan.title}
                      </span>
                      <Space size={4}>
                        <Tag color={PRIORITY_COLOR[plan.priority]} style={{ margin: 0, fontSize: 10 }}>
                          {PRIORITY_MAP[plan.priority]}
                        </Tag>
                        <Tag color={DISPATCH_STATUS_COLOR[plan.status]} style={{ margin: 0, fontSize: 10 }}>
                          {DISPATCH_STATUS_MAP[plan.status]}
                        </Tag>
                      </Space>
                    </div>
                  }
                  actions={[
                    plan.status === 1 && (
                      <Tooltip title="批准">
                        <CheckCircleOutlined
                          style={{ color: '#52c41a', fontSize: 16 }}
                          onClick={() => handleApprove(plan, 2)}
                        />
                      </Tooltip>
                    ),
                    plan.status === 1 && (
                      <Tooltip title="驳回">
                        <CloseCircleOutlined
                          style={{ color: '#ff4d4f', fontSize: 16 }}
                          onClick={() => handleApprove(plan, 3)}
                        />
                      </Tooltip>
                    ),
                    (plan.status === 2 || plan.status === 4) && (
                      <Tooltip title="开始执行">
                        <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                      </Tooltip>
                    ),
                    plan.status <= 4 && (
                      <Tooltip title="取消调度">
                        <StopOutlined
                          style={{ color: '#ff4d4f', fontSize: 16 }}
                          onClick={() => handleCancel(plan)}
                        />
                      </Tooltip>
                    ),
                  ].filter(Boolean)}
                >
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                    编号：{plan.dispatchNo} · 创建于 {dayjs(plan.createdAt).format('MM-DD HH:mm')}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>预计距离：</span>
                    <span>{plan.estimatedDistance?.toFixed(1) || 0} km</span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 12 }}>预计时间：</span>
                    <span>{plan.estimatedDuration || 0} 分钟</span>
                  </div>

                  {plan.assignments && plan.assignments.length > 0 && (
                    <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                        已分配队伍（拖拽分配卡片可重新分配）：
                      </div>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {plan.assignments.map((assignment) => {
                          const isDraggingThis = draggedItem?.type === 'assignment'
                            && draggedItem.assignment?.id === assignment.id;
                          return (
                            <div
                              key={assignment.id}
                              draggable={plan.status <= 2}
                              onDragStart={(e) => handleDragStart(e, {
                                type: 'assignment',
                                assignment,
                                sourcePlanId: plan.id,
                              })}
                              onDragEnd={handleDragEnd}
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setShowReassignModal(true);
                              }}
                              style={{
                                padding: '8px 10px',
                                background: 'rgba(30, 41, 59, 0.7)',
                                borderRadius: 4,
                                fontSize: 12,
                                cursor: plan.status <= 2 ? 'grab' : 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #1e293b',
                                opacity: isDraggingThis ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {plan.status <= 2 && (
                                  <DragOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />
                                )}
                                <span>{assignment.teamName}</span>
                                <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                                  ({assignment.assignmentRole})
                                </span>
                              </div>
                              <Space size={4}>
                                <Tag color="#1890ff" style={{ margin: 0, fontSize: 10 }}>
                                  {assignment.teamCount}人
                                </Tag>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                                  {assignment.status || '待出发'}
                                </span>
                              </Space>
                            </div>
                          );
                        })}
                      </Space>
                    </div>
                  )}
                </Card>
              );
            }}
          />
        )}
      </div>

      {busyTeams.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
            <span style={{ color: '#fa8c16' }}>●</span> 执行任务中（{busyTeams.length}支）
          </div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>
            {busyTeams.slice(0, 5).map((team) => renderTeamCard(team, false))}
          </div>
        </div>
      )}

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlusOutlined />
            生成调度方案
          </div>
        }
        open={showGenerateModal}
        onCancel={() => {
          setShowGenerateModal(false);
          setConflictInfo(null);
        }}
        footer={null}
        width={520}
        maskClosable={false}
      >
        {conflictInfo && conflictInfo.hasConflicts && (
          <Alert
            type="warning"
            showIcon
            message="调度冲突检测"
            description={
              <div>
                <p style={{ marginBottom: 4 }}>以下队伍已被调度至其他灾情：</p>
                <Space wrap>
                  {conflictInfo.conflicts?.map((c: any) => (
                    <Tag key={c.teamId} color="#fa8c16">
                      {c.teamName} - 已调度至 {c.otherIncidentTitle}
                    </Tag>
                  ))}
                </Space>
                <div style={{ marginTop: 8 }}>
                  <Button size="small" onClick={() => setConflictInfo(null)}>
                    忽略冲突，继续生成
                  </Button>
                </div>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleGeneratePlan}>
          <Form.Item
            name="title"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input
              placeholder="请输入方案名称，如：XX灾害救援调度方案"
              showCount
              maxLength={100}
            />
          </Form.Item>

          <Form.Item name="teamIds" label="指定队伍（可选，不选则自动匹配最近队伍）">
            <Select
              mode="multiple"
              placeholder="选择救援队伍，留空则系统自动匹配最近队伍"
              options={teams
                .filter((t) => t.status === 1)
                .map((t) => ({
                  value: t.id,
                  label: `${t.teamName}（${t.teamSize}人 · ${t.teamType}）`,
                }))}
              maxTagCount="responsive"
            />
          </Form.Item>

          <Form.Item name="strategy" label="调度策略">
            <Select
              placeholder="选择调度策略"
              defaultValue="distance"
              options={[
                { value: 'distance', label: '距离优先（最近队伍）' },
                { value: 'capability', label: '能力优先（专业队伍）' },
                { value: 'balanced', label: '综合最优' },
              ]}
            />
          </Form.Item>

          <Form.Item name="taskDescription" label="任务描述">
            <TextArea rows={3} placeholder="请描述具体任务要求、注意事项等" maxLength={500} showCount />
          </Form.Item>

          <Form.Item name="dangerWarning" label="危险提示">
            <TextArea rows={2} placeholder="现场危险情况及注意事项" maxLength={300} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setShowGenerateModal(false);
                  setConflictInfo(null);
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                生成方案
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SwapOutlined />
            重新分配队伍
          </div>
        }
        open={showReassignModal}
        onCancel={() => {
          setShowReassignModal(false);
          setSelectedAssignment(null);
        }}
        footer={null}
        width={480}
        maskClosable={false}
      >
        {selectedAssignment && (
          <>
            <Alert
              type="info"
              showIcon
              message="当前分配"
              description={`${selectedAssignment.teamName} · ${selectedAssignment.teamCount}人 · ${selectedAssignment.assignmentRole}`}
              style={{ marginBottom: 16 }}
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDropOnAvailableArea}
              style={{
                padding: 16,
                marginBottom: 16,
                border: '2px dashed #ff4d4f',
                borderRadius: 6,
                textAlign: 'center',
                background: 'rgba(255, 77, 79, 0.05)',
                color: '#ff4d4f',
                fontSize: 12,
              }}
            >
              <StopOutlined style={{ marginRight: 6 }} />
              拖拽分配卡片到此处可移除该队伍
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
              选择替换队伍，或拖拽上方队伍卡片到目标队伍：
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {availableTeams
                .filter((t) => t.id !== selectedAssignment.teamId)
                .map((team) => (
                  <div
                    key={team.id}
                    onDragOver={(e) => handleDragOver(e, undefined, team.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnTeam(e, team)}
                    onClick={() => {
                      Modal.confirm({
                        title: '确认替换',
                        content: `将 ${selectedAssignment.teamName} 替换为 ${team.teamName}（${team.teamSize}人）？`,
                        onOk: async () => {
                          try {
                            await reassignTeam(selectedAssignment.id, team.id, '点击替换');
                            message.success('队伍替换成功');
                            setShowReassignModal(false);
                            setSelectedAssignment(null);
                          } catch (error) {
                            message.error('替换失败');
                          }
                        },
                      });
                    }}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 6,
                      background: dragOverTeamId === team.id
                        ? 'rgba(24, 144, 255, 0.2)'
                        : 'rgba(30, 41, 59, 0.5)',
                      border: `2px solid ${dragOverTeamId === team.id ? '#1890ff' : '#1e293b'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{team.teamName}</span>
                      <Space size={4}>
                        <Tag color="#52c41a" style={{ margin: 0, fontSize: 10 }}>
                          待命
                        </Tag>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                          {team.teamSize}人 · {team.teamType}
                        </span>
                      </Space>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default DispatchPanel;

import React, { useState } from 'react';
import { Button, Empty, Tag, Space, Card, List, Tooltip, Modal, Form, Select, Input, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, StopOutlined, CheckCircleOutlined, CloseCircleOutlined, DragOutlined } from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import { DISPATCH_STATUS_MAP, DISPATCH_STATUS_COLOR, PRIORITY_MAP, PRIORITY_COLOR } from '@/constants/dictionary';
import { generateDispatchPlan, approveDispatchPlan, cancelDispatchPlan, reassignTeam } from '@/api/dispatch';
import { DispatchPlan } from '@/types';

const { TextArea } = Input;

const DispatchPanel: React.FC = () => {
  const { currentIncident, dispatchPlans, setDispatchPlans, teams } = useCommandStore();
  const [draggedPlan, setDraggedPlan] = useState<DispatchPlan | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [form] = Form.useForm();

  const handleGeneratePlan = async (values: any) => {
    try {
      const plan = await generateDispatchPlan({
        incidentId: currentIncident!.id,
        ...values,
      });
      message.success('调度方案生成成功');
      setShowGenerateModal(false);
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
      content: `确定要取消调度方案【${plan.title}】吗？`,
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

  const handleDragStart = (e: React.DragEvent, plan: DispatchPlan) => {
    setDraggedPlan(plan);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedPlan(null);
  };

  const handleDrop = async (e: React.DragEvent, teamId: number) => {
    e.preventDefault();
    if (!draggedPlan || !selectedAssignment) return;

    try {
      await reassignTeam(selectedAssignment.id, teamId, '拖拽重新分配');
      message.success('队伍重新分配成功');
      setShowReassignModal(false);
    } catch (error) {
      message.error('分配失败');
    }
    setDraggedPlan(null);
    setSelectedAssignment(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const filteredPlans = currentIncident
    ? dispatchPlans.filter((p) => p.incidentId === currentIncident.id)
    : dispatchPlans;

  const displayPlans = filteredPlans.length > 0 ? filteredPlans : dispatchPlans.slice(0, 5);

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
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setShowGenerateModal(true)}
            style={{ width: '100%', marginTop: 8 }}
          >
            生成调度方案
          </Button>
        </div>
      )}

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
            renderItem={(plan) => (
              <Card
                key={plan.id}
                size="small"
                className={`dispatch-card ${draggedPlan?.id === plan.id ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, plan)}
                onDragEnd={handleDragEnd}
                style={{ marginBottom: 12 }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      <DragOutlined style={{ marginRight: 6, color: 'rgba(255,255,255,0.45)' }} />
                      {plan.title}
                    </span>
                    <Tag color={DISPATCH_STATUS_COLOR[plan.status]} style={{ margin: 0 }}>
                      {DISPATCH_STATUS_MAP[plan.status]}
                    </Tag>
                  </div>
                }
                extra={
                  <Tag color={PRIORITY_COLOR[plan.priority]} style={{ margin: 0 }}>
                    {PRIORITY_MAP[plan.priority]}
                  </Tag>
                }
                actions={[
                  plan.status === 1 && (
                    <Tooltip title="批准">
                      <CheckCircleOutlined
                        style={{ color: '#52c41a' }}
                        onClick={() => handleApprove(plan, 2)}
                      />
                    </Tooltip>
                  ),
                  plan.status === 1 && (
                    <Tooltip title="驳回">
                      <CloseCircleOutlined
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleApprove(plan, 3)}
                      />
                    </Tooltip>
                  ),
                  (plan.status === 2 || plan.status === 4) && (
                    <Tooltip title="开始执行">
                      <PlayCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  ),
                  plan.status <= 4 && (
                    <Tooltip title="取消">
                      <StopOutlined
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleCancel(plan)}
                      />
                    </Tooltip>
                  ),
                ].filter(Boolean)}
              >
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                  方案编号：{plan.dispatchNo}
                </div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>预计距离：</span>
                  <span>{plan.estimatedDistance?.toFixed(1) || 0} km</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 12 }}>预计时间：</span>
                  <span>{plan.estimatedDuration || 0} 分钟</span>
                </div>

                {plan.assignments && plan.assignments.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid #1e293b',
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                      已分配队伍（拖拽卡片可重新分配）：
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {plan.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          onClick={() => {
                            setSelectedAssignment(assignment);
                            setShowReassignModal(true);
                          }}
                          style={{
                            padding: '6px 8px',
                            background: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: 4,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>{assignment.teamName}</span>
                          <Tag color="#1890ff" style={{ margin: 0, fontSize: 10 }}>
                            {assignment.teamCount}人
                          </Tag>
                        </div>
                      ))}
                    </Space>
                  </div>
                )}
              </Card>
            )}
          />
        )}
      </div>

      <Modal
        title="生成调度方案"
        open={showGenerateModal}
        onCancel={() => setShowGenerateModal(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleGeneratePlan}>
          <Form.Item
            name="title"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input placeholder="请输入方案名称" />
          </Form.Item>

          <Form.Item name="teamIds" label="指定队伍（可选，不选则自动匹配）">
            <Select
              mode="multiple"
              placeholder="选择救援队伍，留空则系统自动匹配最近队伍"
              options={teams
                .filter((t) => t.status === 1)
                .map((t) => ({
                  value: t.id,
                  label: `${t.teamName}（${t.teamSize}人）`,
                }))}
            />
          </Form.Item>

          <Form.Item name="strategy" label="调度策略">
            <Select
              placeholder="选择调度策略"
              options={[
                { value: 'distance', label: '距离优先（最近队伍）' },
                { value: 'capability', label: '能力优先（专业队伍）' },
                { value: 'balanced', label: '综合最优' },
              ]}
            />
          </Form.Item>

          <Form.Item name="taskDescription" label="任务描述">
            <TextArea rows={3} placeholder="请描述具体任务要求" />
          </Form.Item>

          <Form.Item name="dangerWarning" label="危险提示">
            <TextArea rows={2} placeholder="现场危险情况及注意事项" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowGenerateModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                生成方案
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重新分配队伍"
        open={showReassignModal}
        onCancel={() => {
          setShowReassignModal(false);
          setSelectedAssignment(null);
        }}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
            当前分配：{selectedAssignment?.teamName}
          </div>
          <div style={{ fontSize: 13 }}>
            拖拽左侧调度卡片到目标队伍，或点击下方选择新队伍：
          </div>
        </div>

        <div
          onDrop={handleDrop as any}
          onDragOver={handleDragOver}
          style={{
            padding: 20,
            border: '2px dashed #1e293b',
            borderRadius: 4,
            textAlign: 'center',
            marginBottom: 16,
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {draggedPlan ? (
            <span style={{ color: '#1890ff' }}>释放以重新分配队伍</span>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              拖拽调度方案卡片到此处
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          可用队伍：
        </div>
        <List
          size="small"
          dataSource={teams.filter((t) => t.status === 1)}
          renderItem={(team) => (
            <List.Item
              style={{
                padding: '8px 12px',
                background: 'rgba(30, 41, 59, 0.3)',
                borderRadius: 4,
                marginBottom: 4,
                cursor: 'pointer',
              }}
              onClick={async () => {
                if (selectedAssignment) {
                  try {
                    await reassignTeam(selectedAssignment.id, team.id, '点击重新分配');
                    message.success('队伍重新分配成功');
                    setShowReassignModal(false);
                    setSelectedAssignment(null);
                  } catch (error) {
                    message.error('分配失败');
                  }
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>{team.teamName}</span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  {team.teamSize}人 · {team.teamType}
                </span>
              </div>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default DispatchPanel;

import { Card, Timeline, Tag, Button, Space, Descriptions, Modal, Form, Input, message, List, Row, Col } from 'antd';
import { CheckOutlined, CloseOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { Contract } from '../../types';
import { formatCurrency } from '../../utils/exportUtils';
import { formatDate } from '../../utils/dateUtils';

interface ContractFlowProps {
  contracts: Contract[];
  loading?: boolean;
  onContractClick?: (contract: Contract) => void;
  onApprove?: (contractId: string, comment: string) => void;
  onReject?: (contractId: string, comment: string) => void;
  onSign?: (contractId: string) => void;
  onArchive?: (contractId: string) => void;
}

const statusColors: Record<string, string> = {
  draft: 'default',
  reviewing: 'processing',
  approved: 'success',
  signed: 'success',
  archived: 'default',
  rejected: 'error',
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  reviewing: '审批中',
  approved: '已批准',
  signed: '已签署',
  archived: '已归档',
  rejected: '已拒绝',
};

const ContractFlow: React.FC<ContractFlowProps> = ({
  contracts,
  loading,
  onApprove,
  onReject,
  onSign,
  onArchive,
}) => {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [form] = Form.useForm();

  const handleContractClick = (contract: Contract) => {
    setSelectedContract(contract);
  };

  const handleApproveClick = () => {
    if (!selectedContract) return;
    setActionType('approve');
    form.resetFields();
    setApproveModalOpen(true);
  };

  const handleRejectClick = () => {
    if (!selectedContract) return;
    setActionType('reject');
    form.resetFields();
    setApproveModalOpen(true);
  };

  const handleSubmitApproval = async () => {
    if (!selectedContract) return;
    try {
      const values = await form.validateFields();
      if (actionType === 'approve') {
        onApprove?.(selectedContract.id, values.comment || '');
        message.success('审批通过');
      } else {
        onReject?.(selectedContract.id, values.comment);
        message.success('已驳回');
      }
      setApproveModalOpen(false);
    } catch (error) {
      // Validation error
    }
  };

  const handleSign = () => {
    if (!selectedContract) return;
    onSign?.(selectedContract.id);
  };

  const handleArchive = () => {
    if (!selectedContract) return;
    Modal.confirm({
      title: '归档确认',
      content: '确定要归档该合同吗？归档后将无法修改。',
      onOk: () => {
        onArchive?.(selectedContract!.id);
      },
    });
  };

  const canApproveCurrentStep = (stepOrder: number) => {
    return selectedContract?.currentStep === stepOrder && selectedContract?.status === 'reviewing';
  };

  const timelineItems = selectedContract?.approvalFlow.map((step, index) => {
    const isCompleted = step.status === 'approved';
    const isRejected = step.status === 'rejected';
    const isCurrent = selectedContract?.currentStep === step.order && selectedContract?.status === 'reviewing';
    const isPending = step.status === 'pending';

    let color = 'gray';
    let dot = <ClockCircleOutlined />;

    if (isCompleted) {
      color = 'green';
      dot = <CheckOutlined className="text-white" />;
    } else if (isRejected) {
      color = 'red';
      dot = <CloseOutlined className="text-white" />;
    } else if (isCurrent) {
      color = 'blue';
      dot = <ClockCircleOutlined className="text-white animate-pulse" />;
    }

    return {
      color,
      dot,
      children: (
        <div className={`pb-6 ${index === selectedContract!.approvalFlow.length - 1 ? 'pb-0' : ''}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${isCompleted ? 'text-green-600' : isRejected ? 'text-red-600' : isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                {step.name}
              </span>
              {isCurrent && (
                <Tag color="blue" className="animate-pulse">
                  当前步骤
                </Tag>
              )}
            </div>
            {step.approvedAt && (
              <span className="text-sm text-gray-500">
                {step.approverName} · {formatDate(step.approvedAt)}
              </span>
            )}
          </div>
          
          {step.comment && (
            <div className="text-sm text-gray-600 mb-2 bg-gray-50 p-2 rounded">
              意见：{step.comment}
            </div>
          )}
        </div>
      ),
    };
  }) || [];

  return (
    <Row gutter={16}>
      <Col xs={24} md={8} lg={6}>
        <Card 
          title="合同列表" 
          size="small" 
          loading={loading}
          className="h-full"
          bodyStyle={{ padding: 0, maxHeight: '600px', overflowY: 'auto' }}
        >
          <List
            dataSource={contracts}
            renderItem={(contract) => (
              <List.Item
                className={`cursor-pointer px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${selectedContract?.id === contract.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                onClick={() => handleContractClick(contract)}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{contract.scheduleName}</span>
                    <Tag color={statusColors[contract.status]}>
                      {statusLabels[contract.status]}
                    </Tag>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div>乙方：{contract.partyB}</div>
                    <div>金额：{formatCurrency(contract.amount)}</div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} md={16} lg={18}>
        {selectedContract ? (
          <Card
            loading={loading}
            className="h-full"
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">审批流程</span>
                  <Tag color={statusColors[selectedContract.status]}>
                    {statusLabels[selectedContract.status]}
                  </Tag>
                </div>
                <Space>
                  {selectedContract.status === 'reviewing' && (
                    <>
                      <Button type="primary" size="small" onClick={handleApproveClick}>
                        审批通过
                      </Button>
                      <Button danger size="small" onClick={handleRejectClick}>
                        驳回
                      </Button>
                    </>
                  )}
                  {selectedContract.status === 'approved' && (
                    <Button type="primary" size="small" onClick={handleSign}>
                      电子签章
                    </Button>
                  )}
                  {selectedContract.status === 'signed' && (
                    <Button size="small" onClick={handleArchive}>
                      归档
                    </Button>
                  )}
                </Space>
              </div>
            }
          >
            <div className="space-y-6">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="合同编号">{selectedContract.id}</Descriptions.Item>
                <Descriptions.Item label="关联展会">{selectedContract.scheduleName}</Descriptions.Item>
                <Descriptions.Item label="甲方">{selectedContract.partyA}</Descriptions.Item>
                <Descriptions.Item label="乙方">{selectedContract.partyB}</Descriptions.Item>
                <Descriptions.Item label="合同金额">
                  <span className="text-blue-600 font-medium">{formatCurrency(selectedContract.amount)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="押金金额">
                  <span className="text-orange-600 font-medium">
                    {formatCurrency(selectedContract.depositAmount)} ({selectedContract.depositRate}%)
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="合同模板">{selectedContract.templateName}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatDate(selectedContract.createdAt)}</Descriptions.Item>
              </Descriptions>

              {selectedContract.approvalFlow.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <Timeline
                    items={timelineItems}
                    className="mt-4"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  该合同无需审批流程
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">合同内容</h4>
                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedContract.content}
                </div>
              </div>

              {selectedContract.signedUrl && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckOutlined className="text-green-500" />
                  <span className="text-green-700">合同已签署</span>
                  <Button type="link" size="small">
                    查看签署文件
                  </Button>
                </div>
              )}
            </div>

            <Modal
              title={actionType === 'approve' ? '审批通过' : '审批驳回'}
              open={approveModalOpen}
              onOk={handleSubmitApproval}
              onCancel={() => setApproveModalOpen(false)}
              okText="确认"
              cancelText="取消"
            >
              <Form form={form} layout="vertical">
                <Form.Item
                  name="comment"
                  label="审批意见"
                  rules={actionType === 'reject' ? [{ required: true, message: '请输入驳回原因' }] : []}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={actionType === 'approve' ? '请输入通过意见（可选）' : '请输入驳回原因'}
                  />
                </Form.Item>
              </Form>
            </Modal>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center" loading={loading}>
            <div className="text-center text-gray-500">
              <FileTextOutlined className="text-4xl mb-2 block" />
              <p>请选择一份合同查看详情</p>
            </div>
          </Card>
        )}
      </Col>
    </Row>
  );
};

export default ContractFlow;

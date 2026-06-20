import { useState, useEffect } from 'react';
import { Card, Button, Space, Row, Col, Statistic, Modal, message, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import ContractFlow from '../components/ContractFlow';
import { useContractStore } from '../stores/contractStore';
import type { Contract } from '../types';

const ContractPage: React.FC = () => {
  const { contracts, loading, fetchContracts, approveContract, rejectContract, signContract, archiveContract } = useContractStore();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleContractClick = (contract: Contract) => {
    setSelectedContract(contract);
    setDetailVisible(true);
  };

  const handleApprove = async (contractId: string, comment: string) => {
    await approveContract(contractId, comment);
    message.success('审批通过');
    setDetailVisible(false);
  };

  const handleReject = async (contractId: string, comment: string) => {
    await rejectContract(contractId, comment);
    message.success('已驳回');
    setDetailVisible(false);
  };

  const handleSign = async (contractId: string) => {
    Modal.confirm({
      title: '电子签章确认',
      content: '确定要对该合同进行电子签章吗？',
      onOk: async () => {
        await signContract(contractId);
        message.success('合同已签署');
        setDetailVisible(false);
      },
    });
  };

  const handleArchive = async (contractId: string) => {
    Modal.confirm({
      title: '归档确认',
      content: '确定要归档该合同吗？归档后将无法修改。',
      onOk: async () => {
        await archiveContract(contractId);
        message.success('合同已归档');
        setDetailVisible(false);
      },
    });
  };

  const statistics = {
    total: contracts.length,
    draft: contracts.filter(c => c.status === 'draft').length,
    reviewing: contracts.filter(c => c.status === 'reviewing').length,
    approved: contracts.filter(c => c.status === 'approved').length,
    signed: contracts.filter(c => c.status === 'signed').length,
    archived: contracts.filter(c => c.status === 'archived').length,
  };

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="合同总数" value={statistics.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="草稿" value={statistics.draft} valueStyle={{ color: '#6b7280' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="审批中" value={statistics.reviewing} valueStyle={{ color: '#eab308' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="已批准" value={statistics.approved} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="已签署" value={statistics.signed} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="已归档" value={statistics.archived} valueStyle={{ color: '#6b7280' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="合同中心"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchContracts()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              新建合同
            </Button>
          </Space>
        }
      >
        <ContractFlow
          contracts={contracts}
          loading={loading}
          onContractClick={handleContractClick}
          onApprove={handleApprove}
          onReject={handleReject}
          onSign={handleSign}
          onArchive={handleArchive}
        />
      </Card>

      <Modal
        title="合同详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          selectedContract && selectedContract.status === 'reviewing' ? (
            <Space>
              <Button icon={<EditOutlined />}>编辑</Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => handleReject(selectedContract.id, '')}>
                驳回
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(selectedContract.id, '')}>
                通过
              </Button>
            </Space>
          ) : selectedContract && selectedContract.status === 'approved' ? (
            <Space>
              <Button type="primary" onClick={() => handleSign(selectedContract.id)}>
                电子签章
              </Button>
            </Space>
          ) : selectedContract && selectedContract.status === 'signed' ? (
            <Space>
              <Button onClick={() => handleArchive(selectedContract.id)}>
                归档
              </Button>
            </Space>
          ) : null
        }
        width={700}
      >
        {selectedContract && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{selectedContract.scheduleName}</h3>
              <Tag color={
                selectedContract.status === 'signed' ? 'green' :
                selectedContract.status === 'approved' ? 'blue' :
                selectedContract.status === 'reviewing' ? 'gold' :
                selectedContract.status === 'archived' ? 'gray' : 'default'
              }>
                {selectedContract.status === 'draft' ? '草稿' :
                 selectedContract.status === 'reviewing' ? '审批中' :
                 selectedContract.status === 'approved' ? '已批准' :
                 selectedContract.status === 'signed' ? '已签署' :
                 selectedContract.status === 'archived' ? '已归档' : '已驳回'}
              </Tag>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">合同编号</div>
                  <div className="font-medium">{selectedContract.id.toUpperCase()}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">合同模板</div>
                  <div className="font-medium">{selectedContract.templateName}</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">甲方</div>
                  <div className="font-medium">{selectedContract.partyA}</div>
                </Col>
                <Col span={12}>
                  <div className="text-gray-500 text-sm">乙方</div>
                  <div className="font-medium">{selectedContract.partyB}</div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div className="text-gray-500 text-sm">合同金额</div>
                  <div className="font-medium text-lg text-blue-600">¥{selectedContract.amount.toLocaleString()}</div>
                </Col>
                <Col span={8}>
                  <div className="text-gray-500 text-sm">押金比例</div>
                  <div className="font-medium">{selectedContract.depositRate}%</div>
                </Col>
                <Col span={8}>
                  <div className="text-gray-500 text-sm">押金金额</div>
                  <div className="font-medium">¥{selectedContract.depositAmount.toLocaleString()}</div>
                </Col>
              </Row>
              {selectedContract.archiveNo && (
                <Row gutter={16}>
                  <Col span={12}>
                    <div className="text-gray-500 text-sm">归档编号</div>
                    <div className="font-medium">{selectedContract.archiveNo}</div>
                  </Col>
                </Row>
              )}
            </div>

            <div>
              <div className="text-gray-500 text-sm mb-2">审批流程</div>
              <div className="space-y-2">
                {selectedContract.approvalFlow.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      step.status === 'approved' ? 'bg-green-500' :
                      step.status === 'rejected' ? 'bg-red-500' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{step.name}</div>
                      <div className="text-sm text-gray-500">
                        {step.approverName}
                        {step.status === 'approved' && ` · ${step.approvedAt}`}
                      </div>
                    </div>
                    <Tag color={
                      step.status === 'approved' ? 'green' :
                      step.status === 'rejected' ? 'red' : 'default'
                    }>
                      {step.status === 'approved' ? '已通过' :
                       step.status === 'rejected' ? '已驳回' : '待处理'}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>

            {selectedContract.content && (
              <div>
                <div className="text-gray-500 text-sm mb-2">合同内容摘要</div>
                <div className="text-sm bg-gray-50 p-3 rounded">{selectedContract.content}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContractPage;

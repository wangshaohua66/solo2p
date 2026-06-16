import React, { useState } from 'react';
import {
  Button,
  Empty,
  Tag,
  Space,
  Card,
  List,
  Tooltip,
  Modal,
  Form,
  Select,
  InputNumber,
  message,
  Progress,
  Divider,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RouteOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import { getInventoryList, lockStocks, unlockStock, confirmAllocation, calculateOptimalRoute } from '@/api/inventory';
import { InventoryStock, AllocationRouteResult, AllocationRoute } from '@/types';

const InventoryPanel: React.FC = () => {
  const { currentIncident, warehouses, setWarehouses } = useCommandStore();
  const [stockList, setStockList] = useState<InventoryStock[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeResult, setRouteResult] = useState<AllocationRouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockForm] = Form.useForm();

  const handleWarehouseSelect = async (warehouseId: number) => {
    setSelectedWarehouse(warehouseId);
    setLoading(true);
    try {
      const stocks = await getInventoryList({ warehouseId, pageNum: 1, pageSize: 50 });
      setStockList(stocks.list as unknown as InventoryStock[]);
    } catch (error) {
      message.error('加载库存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLockStock = async (values: any) => {
    try {
      const lockData = {
        incidentId: currentIncident?.id,
        items: [
          {
            warehouseId: selectedWarehouse,
            materialId: values.materialId,
            quantity: values.quantity,
          },
        ],
        lockReason: values.reason,
        lockHours: values.lockHours || 24,
      };
      await lockStocks(lockData);
      message.success('物资锁定成功');
      setShowLockModal(false);
      lockForm.resetFields();
      if (selectedWarehouse) {
        handleWarehouseSelect(selectedWarehouse);
      }
    } catch (error) {
      message.error('锁定失败');
    }
  };

  const handleUnlockStock = async (stock: InventoryStock) => {
    Modal.confirm({
      title: '解锁库存',
      content: `确定要解锁【${stock.materialName}】的锁定库存吗？`,
      okText: '确定解锁',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await unlockStock(stock.id, '手动解锁');
          message.success('解锁成功');
          if (selectedWarehouse) {
            handleWarehouseSelect(selectedWarehouse);
          }
        } catch (error) {
          message.error('解锁失败');
        }
      },
    });
  };

  const handleConfirmAllocation = async (stock: InventoryStock) => {
    Modal.confirm({
      title: '确认调拨',
      content: `确认调拨【${stock.materialName}】 ${stock.lockedQuantity} ${stock.materialName.includes('帐篷') ? '顶' : '件'}？`,
      okText: '确认调拨',
      cancelText: '取消',
      onOk: async () => {
        try {
          await confirmAllocation(stock.id);
          message.success('调拨确认成功');
          if (selectedWarehouse) {
            handleWarehouseSelect(selectedWarehouse);
          }
        } catch (error) {
          message.error('确认失败');
        }
      },
    });
  };

  const handleCalculateRoute = async () => {
    if (!currentIncident) {
      message.warning('请先选择灾情');
      return;
    }
    try {
      const result = await calculateOptimalRoute({
        incidentId: currentIncident.id,
        location: currentIncident.locationPoint,
        materials: stockList
          .filter((s) => s.lockedQuantity > 0)
          .map((s) => ({
            materialId: s.materialId,
            quantity: s.lockedQuantity,
          })),
      });
      setRouteResult(result as unknown as AllocationRouteResult);
      setShowRouteModal(true);
    } catch (error) {
      message.error('路线计算失败');
    }
  };

  const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
  const totalUsed = warehouses.reduce((sum, w) => sum + w.usedCapacity, 0);
  const usagePercent = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

  const lowStockItems = stockList.filter((s) => s.availableQuantity < s.warningThreshold);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {currentIncident && (
        <div
          style={{
            padding: 12,
            marginBottom: 12,
            background: 'rgba(82, 196, 26, 0.1)',
            border: '1px solid rgba(82, 196, 26, 0.3)',
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
            当前灾情
          </div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>{currentIncident.title}</div>
          <Row gutter={8}>
            <Col span={12}>
              <Statistic
                title={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>受灾人数</span>}
                value={currentIncident.affectedPopulation || 0}
                suffix="人"
                style={{ fontSize: 12 }}
                valueStyle={{ fontSize: 16, color: '#fa8c16' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>被困人数</span>}
                value={currentIncident.trapped || 0}
                suffix="人"
                style={{ fontSize: 12 }}
                valueStyle={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Col>
          </Row>
          <Button
            type="primary"
            size="small"
            icon={<RouteOutlined />}
            onClick={handleCalculateRoute}
            style={{ width: '100%', marginTop: 8 }}
            disabled={stockList.filter((s) => s.lockedQuantity > 0).length === 0}
          >
            计算最优调拨路线
          </Button>
        </div>
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          仓库容量概览
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>总容量</span>
            <span>{totalUsed.toLocaleString()} / {totalCapacity.toLocaleString()} 件</span>
          </div>
          <Progress
            percent={usagePercent}
            showInfo={false}
            strokeColor={usagePercent > 80 ? '#ff4d4f' : usagePercent > 60 ? '#faad14' : '#52c41a'}
            size="small"
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag color="#13c2c2">{warehouses.length}个仓库</Tag>
          <Tag color="#faad14">{lowStockItems.length}个预警</Tag>
        </div>
      </Card>

      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        选择仓库：
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {warehouses.map((wh) => (
          <Tag.CheckableTag
            key={wh.id}
            checked={selectedWarehouse === wh.id}
            onChange={() => handleWarehouseSelect(wh.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              background: selectedWarehouse === wh.id ? 'rgba(24, 144, 255, 0.2)' : 'rgba(30, 41, 59, 0.5)',
              border: `1px solid ${selectedWarehouse === wh.id ? '#1890ff' : '#1e293b'}`,
            }}
          >
            {wh.warehouseName}
          </Tag.CheckableTag>
        ))}
      </div>

      {selectedWarehouse && (
        <>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span>库存明细（{stockList.length}种物资）</span>
            <Button
              type="text"
              icon={<LockOutlined />}
              size="small"
              onClick={() => setShowLockModal(true)}
              style={{ color: '#1890ff', padding: 0 }}
            >
              锁定物资
            </Button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
            ) : stockList.length === 0 ? (
              <Empty
                description="暂无库存数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ color: 'rgba(255,255,255,0.45)', marginTop: 40 }}
              />
            ) : (
              <List
                size="small"
                dataSource={stockList}
                renderItem={(stock) => {
                  const isLow = stock.availableQuantity < stock.warningThreshold;
                  return (
                    <Card
                      size="small"
                      style={{
                        marginBottom: 8,
                        borderLeft: `3px solid ${isLow ? '#ff4d4f' : stock.lockedQuantity > 0 ? '#faad14' : '#1e293b'}`,
                      }}
                      title={
                        <div style={{ fontSize: 13 }}>
                          {isLow && <WarningOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />}
                          {stock.materialName}
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginLeft: 8 }}>
                            {stock.materialCode}
                          </span>
                        </div>
                      }
                      extra={
                        <Space size="small">
                          {stock.lockedQuantity > 0 && (
                            <Tooltip title="解锁">
                              <UnlockOutlined
                                style={{ color: '#faad14', cursor: 'pointer' }}
                                onClick={() => handleUnlockStock(stock)}
                              />
                            </Tooltip>
                          )}
                          {stock.lockedQuantity > 0 && (
                            <Tooltip title="确认调拨">
                              <CheckCircleOutlined
                                style={{ color: '#52c41a', cursor: 'pointer' }}
                                onClick={() => handleConfirmAllocation(stock)}
                              />
                            </Tooltip>
                          )}
                        </Space>
                      }
                    >
                      <div className="inventory-row">
                        <span className="name">可用库存</span>
                        <span className={`stock ${isLow ? 'low' : 'normal'}`}>
                          {stock.availableQuantity.toLocaleString()}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>件</span>
                      </div>
                      {stock.lockedQuantity > 0 && (
                        <div className="inventory-row">
                          <span className="name">已锁定</span>
                          <span className="locked">{stock.lockedQuantity.toLocaleString()}</span>
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>件</span>
                        </div>
                      )}
                      <div className="inventory-row">
                        <span className="name">总库存</span>
                        <span style={{ width: 80, textAlign: 'right' }}>
                          {stock.quantity.toLocaleString()}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>件</span>
                      </div>
                      {isLow && (
                        <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>
                          ⚠ 低于预警阈值 {stock.warningThreshold} 件
                        </div>
                      )}
                    </Card>
                  );
                }}
              />
            )}
          </div>
        </>
      )}

      <Modal
        title="锁定物资"
        open={showLockModal}
        onCancel={() => setShowLockModal(false)}
        footer={null}
        width={480}
      >
        <Form form={lockForm} layout="vertical" onFinish={handleLockStock}>
          <Form.Item
            name="materialId"
            label="选择物资"
            rules={[{ required: true, message: '请选择物资' }]}
          >
            <Select
              placeholder="选择要锁定的物资"
              options={stockList
                .filter((s) => s.availableQuantity > 0)
                .map((s) => ({
                  value: s.materialId,
                  label: `${s.materialName}（可用：${s.availableQuantity}件）`,
                }))}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="锁定数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber
              min={1}
              placeholder="请输入锁定数量"
              style={{ width: '100%' }}
              addonAfter="件"
            />
          </Form.Item>

          <Form.Item
            name="lockHours"
            label="锁定时长"
            initialValue={24}
          >
            <InputNumber
              min={1}
              max={720}
              placeholder="锁定时长"
              style={{ width: '100%' }}
              addonAfter="小时"
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="锁定原因"
            rules={[{ required: true, message: '请输入原因' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="灾情救援物资"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowLockModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                <LockOutlined /> 确认锁定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="最优调拨路线"
        open={showRouteModal}
        onCancel={() => setShowRouteModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowRouteModal(false)}>
            关闭
          </Button>,
          <Button key="confirm" type="primary">
            执行调拨
          </Button>,
        ]}
        width={600}
      >
        {routeResult && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>总距离</span>}
                  value={routeResult.totalDistance}
                  suffix="km"
                  valueStyle={{ fontSize: 18, color: '#1890ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>预计时长</span>}
                  value={routeResult.totalEstimatedDuration}
                  suffix="分钟"
                  valueStyle={{ fontSize: 18, color: '#fa8c16' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>预估成本</span>}
                  value={routeResult.totalCost}
                  suffix="元"
                  valueStyle={{ fontSize: 18, color: '#52c41a' }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
              调拨明细：
            </div>
            <List
              size="small"
              dataSource={routeResult.routes}
              renderItem={(route: AllocationRoute) => (
                <List.Item
                  style={{
                    padding: '12px',
                    background: 'rgba(30, 41, 59, 0.3)',
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>
                        <InboxOutlined style={{ marginRight: 6 }} />
                        {route.warehouseName}
                      </span>
                      <Tag color="#1890ff">{route.distance.toFixed(1)} km</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                      {route.materialName} × {route.allocateQuantity} 件
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                        预计 {route.estimatedDuration} 分钟 · ¥{route.cost}
                      </span>
                      <RouteOutlined style={{ color: '#52c41a' }} />
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default InventoryPanel;

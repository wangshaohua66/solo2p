import React from 'react';
import { Card, Table, Tag, Input, Button, Space, Modal, Form, Avatar, message, Drawer, Descriptions, List, Badge } from 'antd';
import { PlusOutlined, SearchOutlined, UserOutlined, EditOutlined, EyeOutlined, PhoneOutlined, MailOutlined, TeamOutlined, HistoryOutlined } from '@ant-design/icons';
import { customerApi, workOrderApi } from '@/api';
import { useState, useEffect } from 'react';
import type { Customer, WorkOrder } from '@/types';
import { STATUS_COLOR, STATUS_LABEL } from '@/types';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const CustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<WorkOrder[]>([]);
  const [createForm] = Form.useForm();

  useEffect(() => { loadList(); }, [page, pageSize, keyword]);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await customerApi.list({ keyword, page, pageSize });
      setList(res.data); setTotal(res.total);
    } finally { setLoading(false); }
  };

  const loadCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
    try {
      setCustomerOrders(await customerApi.getHistory(customer.id));
    } catch {
      setCustomerOrders([]);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await customerApi.create(values);
      message.success('客户创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadList();
    } catch {}
  };

  const columns = [
    {
      title: '客户', dataIndex: 'name', key: 'name',
      render: (v: string, r: Customer) => (
        <Space onClick={() => loadCustomerDetail(r)} style={{ cursor: 'pointer' }}>
          <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 600 }}>{v}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.phone}</div>
          </div>
        </Space>
      )
    },
    { title: '邮箱', dataIndex: 'email', key: 'email', render: v => v || '-' },
    { title: '地址', dataIndex: 'address', key: 'address', render: v => v || '-' },
    {
      title: '累计工单', dataIndex: 'totalOrders', key: 'totalOrders', width: 100,
      render: (v: number) => <Tag color={v >= 5 ? 'gold' : 'blue'}>{v} 次</Tag>
    },
    {
      title: '建档时间', dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: v => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right' as const,
      render: (_: any, r: Customer) => (
        <Space>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => loadCustomerDetail(r)}>详情</Button>
          <Button size="small" type="link" icon={<EditOutlined />}>编辑</Button>
          <Button size="small" type="link" icon={<HistoryOutlined />} onClick={() => navigate(`/work-orders?customer=${r.id}`)}>工单</Button>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}><TeamOutlined /> 客户管理 <Tag color="blue">{total} 位</Tag></h3>
          <Space>
            <Input
              style={{ width: 260 }}
              placeholder="搜索姓名、电话、邮箱"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={() => { setPage(1); loadList(); }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>新增客户</Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={{
            current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true,
            showTotal: t => `共 ${t} 位客户`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); }
          }}
        />
      </Card>

      <Modal title="新增客户" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreate} okText="创建" destroyOnClose>
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="客户姓名" prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="phone" label="电话" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="手机号" prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="（用于发送报告）" prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} placeholder="（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selectedCustomer?.name}
        width={520}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={
          <Space>
            <Button icon={<HistoryOutlined />} onClick={() => { if (selectedCustomer) navigate(`/work-orders?customer=${selectedCustomer.id}`); }}>全部工单</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/intake')}>新建工单</Button>
          </Space>
        }
      >
        {selectedCustomer && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small">
              <Space align="center" size="large">
                <Avatar size={64} style={{ backgroundColor: '#1677ff', fontSize: 24 }} icon={<UserOutlined />} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedCustomer.name}</div>
                  <div style={{ color: '#8c8c8c', marginTop: 4 }}>
                    <Space size="large">
                      <Space><PhoneOutlined /> {selectedCustomer.phone}</Space>
                      {selectedCustomer.email && <Space><MailOutlined /> {selectedCustomer.email}</Space>}
                    </Space>
                  </div>
                </div>
                <Tag color="gold" style={{ marginLeft: 'auto' }}>VIP 客户 · {selectedCustomer.totalOrders} 次</Tag>
              </Space>
              <Divider style={{ margin: '16px 0' }} />
              <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
                <Descriptions.Item label="邮箱">{selectedCustomer.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址">{selectedCustomer.address || '-'}</Descriptions.Item>
                <Descriptions.Item label="建档时间">{dayjs(selectedCustomer.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title={`历史工单（${customerOrders.length}）`}>
              {customerOrders.length === 0 ? (
                <Empty description="暂无工单记录" />
              ) : (
                <List
                  size="small"
                  dataSource={customerOrders}
                  renderItem={(o) => (
                    <List.Item
                      actions={[<Button size="small" type="link" onClick={() => navigate(`/work-orders/${o.id}`)}>查看</Button>]}
                    >
                      <List.Item.Meta
                        avatar={<Badge color={STATUS_COLOR[o.status]} />}
                        title={
                          <Space>
                            <strong>{o.orderNumber}</strong>
                            <Tag color={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <span>{o.brand} {o.model}</span>
                            <span style={{ fontSize: 12, color: '#8c8c8c' }}>{dayjs(o.createdAt).format('YYYY-MM-DD')} · ¥{o.totalPrice.toFixed(2)}</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </Space>
  );
};

export default CustomerPage;

import { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, Modal, Form, Input, Select, Switch, message, Row, Col, Statistic, Tabs, List, Avatar, Badge, Popconfirm } from 'antd';
import { ReloadOutlined, PlusOutlined, UserOutlined, KeyOutlined, SettingOutlined, DatabaseOutlined, FileTextOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { User, Role, OperationLog } from '../types';
import { formatDate, formatRelativeTime } from '../utils/dateUtils';

const { Option } = Select;

const roleLabels: Record<string, string> = {
  admin: '系统管理员',
  operator: '场馆运营',
  organizer: '主办方',
  exhibitor: '参展商',
  builder: '搭建商',
  provider: '服务商',
  visitor: '观众',
};

const SystemPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'logs' | 'settings'>('users');
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [roleForm] = Form.useForm();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockUsers: User[] = Array.from({ length: 15 }, (_, i) => ({
        id: `usr-${1000 + i}`,
        username: `user${i + 1}`,
        realName: ['李经理', '王会计', '张主管', '刘专员', '陈运营'][i % 5] + (i > 4 ? ` ${i + 1}` : ''),
        role: ['admin', 'operator', 'organizer', 'exhibitor', 'provider', 'visitor'][i % 6] as User['role'],
        email: `user${i + 1}@exhibition.com`,
        phone: `138${String(10000000 + i).slice(-8)}`,
        company: i < 2 ? '市级国际会展中心' : ['华为技术', '阿里巴巴', '腾讯科技', '京东集团'][i % 4],
        permissions: {
          schedule: i < 3,
          contract: i < 3,
          finance: i < 2,
          booth: i < 4,
          provider: i < 3 || i === 5,
          visitor: i < 3 || i === 6,
          analytics: i < 2,
          system: i < 1,
        } as Record<string, boolean>,
        avatar: '',
        createdAt: new Date(Date.now() - i * 86400000 * 30).toISOString(),
        updatedAt: new Date(Date.now() - i * 86400000 * 7).toISOString(),
      }));
      setUsers(mockUsers);

      const mockRoles: Role[] = [
        { id: 'role-1', name: '系统管理员', code: 'admin', description: '拥有系统所有权限', permissions: ['*'], createdAt: '2024-01-01T00:00:00Z' },
        { id: 'role-2', name: '场馆运营', code: 'operator', description: '负责日常运营管理', permissions: ['schedule', 'contract', 'finance', 'booth', 'provider', 'visitor'], createdAt: '2024-01-01T00:00:00Z' },
        { id: 'role-3', name: '主办方', code: 'organizer', description: '展会主办方', permissions: ['schedule', 'contract', 'booth'], createdAt: '2024-01-01T00:00:00Z' },
        { id: 'role-4', name: '参展商', code: 'exhibitor', description: '参展企业', permissions: ['booth'], createdAt: '2024-01-01T00:00:00Z' },
        { id: 'role-5', name: '服务商', code: 'provider', description: '服务供应商', permissions: ['provider'], createdAt: '2024-01-01T00:00:00Z' },
        { id: 'role-6', name: '观众', code: 'visitor', description: '参观观众', permissions: ['visitor'], createdAt: '2024-01-01T00:00:00Z' },
      ];
      setRoles(mockRoles);

      const operations = ['登录系统', '创建档期', '修改合同', '财务记账', '分配展位', '审核服务商', '导出报表', '修改配置'];
      const modules = ['档期管理', '合同中心', '财务结算', '展位管理', '服务商管理', '系统管理'];
      const mockLogs: OperationLog[] = Array.from({ length: 50 }, (_, i) => ({
        id: `log-${10000 + i}`,
        userId: `usr-${1000 + (i % 15)}`,
        userName: mockUsers[i % 15].realName,
        operation: operations[i % operations.length],
        module: modules[i % modules.length],
        details: { ip: `192.168.1.${i % 255}`, userAgent: 'Chrome 120.0' },
        ip: `192.168.1.${i % 255}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      }));
      setLogs(mockLogs);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setUserModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      realName: user.realName,
      role: user.role,
      email: user.email,
      phone: user.phone,
      company: user.company,
    });
    setUserModalVisible(true);
  };

  const handleUserSubmit = async (values: any) => {
    try {
      if (editingUser) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...values } : u));
        message.success('用户信息已更新');
      } else {
        const newUser: User = {
          id: `usr-${Date.now()}`,
          ...values,
          permissions: { schedule: false, contract: false, finance: false, booth: false, provider: false, visitor: false, analytics: false, system: false },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUsers(prev => [newUser, ...prev]);
        message.success('用户创建成功');
      }
      setUserModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDeleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    message.success('用户已删除');
  };

  const handleRoleSubmit = async (values: any) => {
    try {
      const newRole: Role = {
        id: `role-${Date.now()}`,
        ...values,
        permissions: values.permissions || [],
        createdAt: new Date().toISOString(),
      };
      setRoles(prev => [newRole, ...prev]);
      message.success('角色创建成功');
      setRoleModalVisible(false);
      roleForm.resetFields();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleBackup = () => {
    Modal.confirm({
      title: '数据备份确认',
      content: '确定要进行全量数据备份吗？',
      onOk: () => {
        message.success('数据备份已完成');
      },
    });
  };

  const handleRestore = () => {
    Modal.confirm({
      title: '数据恢复确认',
      content: '恢复数据将覆盖现有数据，确定继续吗？',
      onOk: () => {
        message.success('数据恢复已完成');
      },
    });
  };

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      key: 'realName',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color="blue">{roleLabels[role]}</Tag>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '所属单位',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该用户吗？" onConfirm={() => handleDeleteUser(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '权限数量',
      key: 'permissionCount',
      render: (_: any, record: Role) => record.permissions.length,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: () => (
        <Space size="small">
          <Button type="link" size="small">编辑</Button>
          <Button type="link" size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => formatRelativeTime(date),
    },
    {
      title: '操作人',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (mod: string) => <Tag>{mod}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
    },
  ];

  const permissionOptions = [
    { label: '档期管理', value: 'schedule' },
    { label: '合同中心', value: 'contract' },
    { label: '财务结算', value: 'finance' },
    { label: '展位管理', value: 'booth' },
    { label: '服务商管理', value: 'provider' },
    { label: '观众服务', value: 'visitor' },
    { label: '数据分析', value: 'analytics' },
    { label: '系统管理', value: 'system' },
  ];

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="用户总数" value={users.length} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="角色数量" value={roles.length} prefix={<KeyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="今日操作" value={logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="总操作日志" value={logs.length} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        tabList={[
          { key: 'users', tab: <Space><UserOutlined />用户管理</Space> },
          { key: 'roles', tab: <Space><KeyOutlined />角色权限</Space> },
          { key: 'logs', tab: <Space><FileTextOutlined />操作日志</Space> },
          { key: 'settings', tab: <Space><SettingOutlined />系统设置</Space> },
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as any)}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            {(activeTab === 'users' || activeTab === 'roles') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => activeTab === 'users' ? handleAddUser() : setRoleModalVisible(true)}>
                新建{activeTab === 'users' ? '用户' : '角色'}
              </Button>
            )}
          </Space>
        }
      >
        {activeTab === 'users' && (
          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
        {activeTab === 'roles' && (
          <Table
            columns={roleColumns}
            dataSource={roles}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
        {activeTab === 'logs' && (
          <Table
            columns={logColumns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
          />
        )}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <Card title="数据管理" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Button icon={<DatabaseOutlined />} block onClick={handleBackup}>
                    数据备份
                  </Button>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Button icon={<DatabaseOutlined />} block onClick={handleRestore}>
                    数据恢复
                  </Button>
                </Col>
              </Row>
            </Card>
            <Card title="系统参数" size="small">
              <List
                dataSource={[
                  { label: '系统名称', value: '市级国际会展中心智慧运营系统' },
                  { label: '版本号', value: 'v1.0.0' },
                  { label: '文件上传限制', value: '50MB' },
                  { label: '会话超时时间', value: '30分钟' },
                  { label: '密码最小长度', value: '6位' },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta title={item.label} description={item.value} />
                    <Button type="link" size="small">修改</Button>
                  </List.Item>
                )}
              />
            </Card>
          </div>
        )}
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleUserSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="realName"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {Object.entries(roleLabels).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
              >
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="手机"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="company"
            label="所属单位"
            rules={[{ required: true, message: '请输入所属单位' }]}
          >
            <Input placeholder="请输入所属单位" />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="初始密码"
              rules={[{ required: true, message: '请输入初始密码' }]}
            >
              <Input.Password placeholder="请输入初始密码" />
            </Form.Item>
          )}
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setUserModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">{editingUser ? '保存修改' : '创建用户'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建角色"
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={roleForm} layout="vertical" onFinish={handleRoleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="角色名称"
                rules={[{ required: true, message: '请输入角色名称' }]}
              >
                <Input placeholder="请输入角色名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="角色编码"
                rules={[{ required: true, message: '请输入角色编码' }]}
              >
                <Input placeholder="请输入角色编码" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="角色描述"
            rules={[{ required: true, message: '请输入角色描述' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入角色描述" />
          </Form.Item>
          <Form.Item
            name="permissions"
            label="权限配置"
            rules={[{ required: true, message: '请选择权限' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择权限"
              options={permissionOptions}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setRoleModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建角色</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemPage;
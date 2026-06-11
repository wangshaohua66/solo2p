import { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Tabs,
  Input,
  Select,
  Space,
  Button,
  Avatar,
  Tag,
  Table,
  Modal,
  Form,
  Descriptions,
  Popconfirm,
  Badge,
  InputNumber,
} from 'antd';
import {
  Search,
  Plus,
  Edit3,
  Eye,
  Mail,
  Phone,
} from 'lucide-react';
import type { Member, MemberRole, MemberStatus, MemberRoleConfig, WatchlistEntry } from '@/types';
import { mockMembers, mockRoleConfigs, mockWatchlist, mockIncidents } from '@/mocks';
import RoleTag from '@/components/RoleTag';
import KilnTypeTag from '@/components/KilnTypeTag';

const STATUS_TAG: Record<MemberStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: '正常' },
  SUSPENDED: { color: 'red', label: '已暂停' },
  WATCHLIST: { color: 'orange', label: '观察中' },
};

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'STUDENT', label: '学生' },
  { value: 'REGULAR', label: '普通' },
  { value: 'PROFESSIONAL', label: '专业艺术家' },
  { value: 'ADMIN', label: '管理员' },
];

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState('members');
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRole | undefined>();
  const [statusFilter, setStatusFilter] = useState<MemberStatus | undefined>();

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [roleConfigModalOpen, setRoleConfigModalOpen] = useState(false);
  const [editRoleConfig, setEditRoleConfig] = useState<MemberRoleConfig | null>(null);

  const [memberForm] = Form.useForm();
  const [roleConfigForm] = Form.useForm();

  const members = mockMembers;
  const roleConfigs = mockRoleConfigs;
  const watchlist = mockWatchlist;

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!m.realName.toLowerCase().includes(q) && !m.username.toLowerCase().includes(q)) return false;
      }
      if (roleFilter && m.role !== roleFilter) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      return true;
    });
  }, [members, searchText, roleFilter, statusFilter]);

  const incidentCounts = useMemo(() => {
    const map: Record<number, number> = {};
    mockIncidents.forEach((inc) => {
      map[inc.memberId] = (map[inc.memberId] || 0) + 1;
    });
    return map;
  }, []);

  const handleAddMember = () => {
    setEditMember(null);
    memberForm.resetFields();
    setMemberModalOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setEditMember(member);
    memberForm.setFieldsValue(member);
    setMemberModalOpen(true);
  };

  const handleMemberSubmit = () => {
    memberForm.validateFields().then(() => {
      setMemberModalOpen(false);
      memberForm.resetFields();
    });
  };

  const handleDetail = (member: Member) => {
    setDetailMember(member);
    setDetailModalOpen(true);
  };

  const handleEditRoleConfig = (config: MemberRoleConfig) => {
    setEditRoleConfig(config);
    roleConfigForm.setFieldsValue({
      allowedKilnTypes: config.allowedKilnTypes,
      maxAdvanceDays: config.maxAdvanceDays,
      maxDurationHours: config.maxDurationHours,
    });
    setRoleConfigModalOpen(true);
  };

  const handleRoleConfigSubmit = () => {
    roleConfigForm.validateFields().then(() => {
      setRoleConfigModalOpen(false);
      roleConfigForm.resetFields();
    });
  };

  const handleRemoveFromWatchlist = (entry: WatchlistEntry) => {
    Modal.confirm({
      title: '确认移出观察名单',
      content: `确定要将 ${entry.memberName} 移出观察名单吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {},
    });
  };

  const isWatchUntilApproaching = (watchUntil: string) => {
    const diff = new Date(watchUntil).getTime() - Date.now();
    return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  };

  const roleConfigColumns = [
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: MemberRole) => <RoleTag role={role} />,
    },
    {
      title: '允许窑炉类型',
      dataIndex: 'allowedKilnTypes',
      key: 'allowedKilnTypes',
      render: (types: MemberRoleConfig['allowedKilnTypes']) => (
        <Space>
          {types.map((t) => (
            <KilnTypeTag key={t} type={t} />
          ))}
        </Space>
      ),
    },
    {
      title: '最大提前天数',
      dataIndex: 'maxAdvanceDays',
      key: 'maxAdvanceDays',
      width: 120,
    },
    {
      title: '最大时长(小时)',
      dataIndex: 'maxDurationHours',
      key: 'maxDurationHours',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: MemberRoleConfig) => (
        <Button
          type="link"
          size="small"
          icon={<Edit3 size={14} />}
          onClick={() => handleEditRoleConfig(record)}
        >
          编辑
        </Button>
      ),
    },
  ];

  const watchlistColumns = [
    { title: '会员', dataIndex: 'memberName', key: 'memberName', width: 120 },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    {
      title: '关联事件ID',
      dataIndex: 'incidentId',
      key: 'incidentId',
      width: 120,
      render: (val: number | null) => val ?? '-',
    },
    {
      title: '观察截止日期',
      dataIndex: 'watchUntil',
      key: 'watchUntil',
      width: 140,
      render: (val: string) => (
        <span style={isWatchUntilApproaching(val) ? { color: '#E8602C', fontWeight: 600 } : {}}>
          {val}
        </span>
      ),
    },
    { title: '添加日期', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: WatchlistEntry) => (
        <Popconfirm
          title="确定移出观察名单？"
          onConfirm={() => handleRemoveFromWatchlist(record)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" danger size="small">
            移出观察名单
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'members', label: '会员列表' },
          { key: 'roles', label: '权限配置' },
          { key: 'watchlist', label: '观察名单' },
        ]}
      />

      {activeTab === 'members' && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Input
                placeholder="搜索姓名/用户名"
                prefix={<Search size={14} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 220 }}
                allowClear
              />
              <Select
                placeholder="角色筛选"
                value={roleFilter}
                onChange={setRoleFilter}
                allowClear
                style={{ width: 140 }}
                options={ROLE_OPTIONS}
              />
              <Select
                placeholder="状态筛选"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 140 }}
                options={Object.entries(STATUS_TAG).map(([key, val]) => ({
                  value: key,
                  label: val.label,
                }))}
              />
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={handleAddMember}
                style={{ marginLeft: 'auto' }}
              >
                添加会员
              </Button>
            </Space>
          </Card>

          <Row gutter={[16, 16]}>
            {filteredMembers.map((member) => (
              <Col key={member.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{ position: 'relative' }}
                  actions={[
                    <Button
                      type="link"
                      key="edit"
                      icon={<Edit3 size={14} />}
                      onClick={() => handleEditMember(member)}
                    >
                      编辑
                    </Button>,
                    <Button
                      type="link"
                      key="detail"
                      icon={<Eye size={14} />}
                      onClick={() => handleDetail(member)}
                    >
                      查看详情
                    </Button>,
                  ]}
                >
                  {incidentCounts[member.id] > 0 && (
                    <Badge
                      count={incidentCounts[member.id]}
                      style={{ position: 'absolute', top: 16, right: 16 }}
                    >
                      <span />
                    </Badge>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Avatar
                      size={56}
                      style={{
                        backgroundColor: '#E8602C',
                        fontSize: 24,
                      }}
                    >
                      {member.realName.charAt(0)}
                    </Avatar>
                    <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>
                      {member.realName}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <RoleTag role={member.role} />
                    </div>
                  </div>
                  <div style={{ color: '#666', fontSize: 13 }}>
                    <div style={{ marginBottom: 6 }}>
                      <Mail size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      {member.email}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <Phone size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      {member.phone}
                    </div>
                    <div>
                      状态： <Tag color={STATUS_TAG[member.status].color}>{STATUS_TAG[member.status].label}</Tag>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {activeTab === 'roles' && (
        <Card>
          <Table
            rowKey="id"
            columns={roleConfigColumns}
            dataSource={roleConfigs}
            pagination={false}
          />
        </Card>
      )}

      {activeTab === 'watchlist' && (
        <Card>
          <Table
            rowKey="id"
            columns={watchlistColumns}
            dataSource={watchlist}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          />
        </Card>
      )}

      <Modal
        title={editMember ? '编辑会员' : '添加会员'}
        open={memberModalOpen}
        onOk={handleMemberSubmit}
        onCancel={() => {
          setMemberModalOpen(false);
          memberForm.resetFields();
        }}
        okText="确认"
      >
        <Form form={memberForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="realName"
                label="真实姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ required: true, message: '请输入邮箱' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="手机号"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select options={ROLE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select
                  options={Object.entries(STATUS_TAG).map(([key, val]) => ({
                    value: key,
                    label: val.label,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="会员详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={520}
      >
        {detailMember && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户名">{detailMember.username}</Descriptions.Item>
            <Descriptions.Item label="姓名">{detailMember.realName}</Descriptions.Item>
            <Descriptions.Item label="角色"><RoleTag role={detailMember.role} /></Descriptions.Item>
            <Descriptions.Item label="邮箱">{detailMember.email}</Descriptions.Item>
            <Descriptions.Item label="手机">{detailMember.phone}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_TAG[detailMember.status].color}>
                {STATUS_TAG[detailMember.status].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="违规次数">
              <Badge count={incidentCounts[detailMember.id] || 0} />
            </Descriptions.Item>
            <Descriptions.Item label="注册日期">{detailMember.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新日期">{detailMember.updatedAt}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={`编辑权限 - ${editRoleConfig ? ROLE_OPTIONS.find((r) => r.value === editRoleConfig.role)?.label : ''}`}
        open={roleConfigModalOpen}
        onOk={handleRoleConfigSubmit}
        onCancel={() => {
          setRoleConfigModalOpen(false);
          roleConfigForm.resetFields();
        }}
        okText="确认"
      >
        <Form form={roleConfigForm} layout="vertical">
          <Form.Item
            name="allowedKilnTypes"
            label="允许窑炉类型"
            rules={[{ required: true, message: '请选择窑炉类型' }]}
          >
            <Select
              mode="multiple"
              options={[
                { value: 'EXPERIMENTAL', label: '实验窑' },
                { value: 'WORKING', label: '工作窑' },
                { value: 'ANNEALING', label: '退火窑' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="maxAdvanceDays"
            label="最大提前天数"
            rules={[{ required: true, message: '请输入天数' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="maxDurationHours"
            label="最大时长(小时)"
            rules={[{ required: true, message: '请输入小时数' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

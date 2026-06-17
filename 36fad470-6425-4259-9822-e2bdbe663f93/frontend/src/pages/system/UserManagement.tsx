import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Avatar,
  Popconfirm
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UserOutlined, PlusOutlined } from '@ant-design/icons'
import { UserRole } from '@/types'
import type { User } from '@/types'

const roleLabels: Record<UserRole, string> = {
  [UserRole.VENUE_ADMIN]: '场馆管理员',
  [UserRole.ORGANIZER]: '演出主办方',
  [UserRole.FINANCE]: '财务人员',
  [UserRole.AUDIENCE]: '观众'
}

const roleColors: Record<UserRole, string> = {
  [UserRole.VENUE_ADMIN]: 'red',
  [UserRole.ORGANIZER]: 'blue',
  [UserRole.FINANCE]: 'purple',
  [UserRole.AUDIENCE]: 'default'
}

const mockUsers: User[] = [
  {
    id: 'u1',
    username: 'admin',
    email: 'admin@theater.com',
    role: UserRole.VENUE_ADMIN,
    name: '张管理',
    phone: '13800138001'
  },
  {
    id: 'u2',
    username: 'organizer1',
    email: 'org1@theater.com',
    role: UserRole.ORGANIZER,
    name: '李主办',
    phone: '13800138002'
  },
  {
    id: 'u3',
    username: 'finance1',
    email: 'finance@theater.com',
    role: UserRole.FINANCE,
    name: '王财务',
    phone: '13800138003'
  },
  {
    id: 'u4',
    username: 'audience1',
    email: 'user1@example.com',
    role: UserRole.AUDIENCE,
    name: '赵观众',
    phone: '13800138004'
  },
  {
    id: 'u5',
    username: 'audience2',
    email: 'user2@example.com',
    role: UserRole.AUDIENCE,
    name: '钱戏迷',
    phone: '13800138005'
  },
  {
    id: 'u6',
    username: 'organizer2',
    email: 'org2@theater.com',
    role: UserRole.ORGANIZER,
    name: '孙演出',
    phone: '13800138006'
  }
]

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()

  const filteredUsers = roleFilter ? users.filter((u) => u.role === roleFilter) : users

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ role: UserRole.AUDIENCE })
    setModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue(user)
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    setUsers(users.filter((u) => u.id !== id))
    message.success('用户已删除')
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingUser) {
        setUsers(
          users.map((u) =>
            u.id === editingUser.id ? { ...u, ...values } : u
          )
        )
        message.success('用户信息已更新')
      } else {
        const newUser: User = {
          id: `u_${Date.now()}`,
          ...values
        }
        setUsers([...users, newUser])
        message.success('用户已添加')
      }
      setModalOpen(false)
    } catch {
      // validation
    }
  }

  const columns: ColumnsType<User> = [
    {
      title: '用户',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={undefined} />
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 500 }}>{record.name}</span>
            <span style={{ fontSize: 12, color: '#909399' }}>@{record.username}</span>
          </Space>
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: UserRole) => <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 140
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.role !== UserRole.VENUE_ADMIN && (
            <Popconfirm
              title="确定删除该用户？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="card-header">
        <div className="card-title">用户管理</div>
        <Space>
          <Select
            placeholder="角色筛选"
            style={{ width: 140 }}
            allowClear
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as UserRole)}
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label
            }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加用户
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingUser ? '保存' : '添加'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="登录用户名" />
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
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效邮箱' }
            ]}
          >
            <Input placeholder="电子邮箱" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号码" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              options={Object.entries(roleLabels).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

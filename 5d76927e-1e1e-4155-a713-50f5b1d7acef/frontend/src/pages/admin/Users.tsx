import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Avatar, Input, Modal, Form, message } from 'antd'
import { SearchOutlined, EditOutlined, UserOutlined } from '@ant-design/icons'
import { adminApi } from '@/api/admin'
import { User, UserRoleMap, PageResult } from '@/types'

const AdminUsers: React.FC = () => {
  const [data, setData] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getAllUsers({ page, size })
      const result = res.data as unknown as PageResult<User>
      let users = result?.content || []
      if (keyword) {
        users = users.filter(u =>
          u.username.includes(keyword) || u.realName?.includes(keyword) || u.email.includes(keyword)
        )
      }
      setData(users)
      setTotal(result?.totalElements || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, size])

  const handleEdit = (record: User) => {
    setCurrentUser(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleSubmit = async (values: any) => {
    if (!currentUser) return
    try {
      await adminApi.updateUser(currentUser.id, values)
      message.success('更新成功')
      setModalVisible(false)
      fetchData()
    } catch (e) { console.error(e) }
  }

  const columns = [
    {
      title: '用户', key: 'user', render: (_: any, r: User) => (
        <Space>
          <Avatar src={r.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#c8a96e' }} />
          <div>
            <div style={{ color: '#e8e8e8' }}>{r.realName || r.username}</div>
            <div style={{ color: '#707070', fontSize: 12 }}>@{r.username}</div>
          </div>
        </Space>
      )
    },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '手机号', dataIndex: 'phone', key: 'phone', render: (p?: string) => p || '-' },
    { title: '机构', dataIndex: 'organization', key: 'organization', render: (o?: string) => o || '-' },
    {
      title: '角色', key: 'roles', render: (_: any, r: User) => (
        <Space>
          {r.roles?.map(role => <Tag key={role} color="gold">{UserRoleMap[role]}</Tag>)}
        </Space>
      )
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled',
      render: (e: boolean) => e ? <Tag color="green">正常</Tag> : <Tag color="red">禁用</Tag>
    },
    {
      title: '操作', key: 'actions', render: (_: any, record: User) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
      )
    }
  ]

  return (
    <div>
      <Card style={{ borderRadius: 8, marginBottom: 16 }} title={<span style={{ color: '#c8a96e' }}>用户管理</span>}
        extra={
          <Input placeholder="搜索用户" prefix={<SearchOutlined />} value={keyword}
            onChange={(e) => setKeyword(e.target.value)} onPressEnter={fetchData} style={{ width: 200 }} />
        }>
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{
          current: page + 1, pageSize: size, total, showSizeChanger: true,
          onChange: (p, s) => { setPage(p - 1); setSize(s) }
        }} />
      </Card>

      <Modal title="编辑用户" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="realName" label="真实姓名"><Input /></Form.Item>
          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="organization" label="所属机构"><Input /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setModalVisible(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminUsers

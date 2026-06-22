import React, { useEffect, useState } from 'react'
import {
  Card, Table, Tag, Button, Space, Input, Modal, Form, message, Popconfirm, InputNumber, DatePicker, Select
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import { inheritorApi } from '@/api/inheritor'
import { Inheritor, PageResult } from '@/types'

const { Option } = Select
const { TextArea } = Input

const AdminInheritors: React.FC = () => {
  const [data, setData] = useState<Inheritor[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<Inheritor | null>(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await inheritorApi.getList({ keyword: keyword || undefined, page, size })
      const result = res.data as unknown as PageResult<Inheritor>
      setData(result?.content || [])
      setTotal(result?.totalElements || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, size])

  const handleEdit = (record: Inheritor) => {
    setEditingItem(record)
    form.setFieldsValue({
      ...record,
      birthDate: record.birthDate ? record.birthDate : undefined
    })
    setModalVisible(true)
  }

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try { await inheritorApi.delete(id)
      message.success('删除成功')
      fetchData()
    } catch (e) { console.error(e) }
  }

  const handleSubmit = async (values: any) => {
    try {
      const payload = { ...values }
      if (values.birthDate) {
        payload.birthDate = values.birthDate.format('YYYY-MM-DD')
      }
      if (editingItem) {
        await inheritorApi.update(editingItem.id, payload)
        message.success('更新成功')
      } else {
        await inheritorApi.create(payload)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (e) { console.error(e) }
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ color: '#e8e8e8' }}>{t}</span> },
    { title: '性别', dataIndex: 'gender', key: 'gender' },
    { title: '年龄', dataIndex: 'age', key: 'age' },
    { title: '民族', dataIndex: 'ethnicity', key: 'ethnicity' },
    { title: '地区', dataIndex: 'region', key: 'region' },
    { title: '传承项目数', dataIndex: 'heritageIds', key: 'heritageIds', render: (ids: string[]) => ids?.length || 0 },
    { title: '收徒数', dataIndex: 'apprenticeCount', key: 'apprenticeCount' },
    {
      title: '操作', key: 'actions', render: (_: any, record: Inheritor) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ borderRadius: 8, marginBottom: 16 }} title={<span style={{ color: '#c8a96e' }}>传承人管理</span>}
        extra={
          <Space>
            <Input placeholder="搜索姓名" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={fetchData} style={{ width: 200 }} />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增传承人</Button>
          </Space>
        }>
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{
          current: page + 1, pageSize: size, total, showSizeChanger: true,
          onChange: (p, s) => { setPage(p - 1); setSize(s) }
        }} />
      </Card>
      <Modal title={editingItem ? '编辑传承人' : '新增传承人'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="name" label="姓名" rules={[{ required: true }] style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="gender" label="性别" rules={[{ required: true }] style={{ flex: 1 }}>
              <Select><Option value="男">男</Option><Option value="女">女</Option></Select>
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="birthDate" label="出生日期" style={{ flex: 1 }}><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="ethnicity" label="民族" style={{ flex: 1 }}><Input /></Form.Item>
          </div>
          <Form.Item name="region" label="籍贯地区" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="bio" label="个人简介"><TextArea rows={2} /></Form.Item>
          <Form.Item name="skillCharacteristics" label="技艺特点"><TextArea rows={2} /></Form.Item>
          <Form.Item name="representativeWorks" label="代表作品"><TextArea rows={2} /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space><Button onClick={() => setModalVisible(false)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminInheritors

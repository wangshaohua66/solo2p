import React, { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { heritageApi } from '@/api/heritage'
import {
  Heritage,
  HeritageCategory,
  HeritageLevel,
  HeritageCategoryMap,
  HeritageLevelMap,
  PageResult,
} from '@/types'

const { Option } = Select
const { TextArea } = Input

const AdminHeritages: React.FC = () => {
  const [data, setData] = useState<Heritage[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<Heritage | null>(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await heritageApi.getList({ keyword: keyword || undefined, page, size })
      const result = res.data as unknown as PageResult<Heritage>
      setData(result?.content || [])
      setTotal(result?.totalElements || 0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, size])

  const handleEdit = (record: Heritage) => {
    setEditingItem(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await heritageApi.delete(id)
      message.success('删除成功')
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingItem) {
        await heritageApi.update(editingItem.id, values)
        message.success('更新成功')
      } else {
        await heritageApi.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const columns = [
    { title: '项目名称', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ color: '#e8e8e8' }}>{t}</span> },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (c: HeritageCategory) => <Tag color="gold">{HeritageCategoryMap[c]}</Tag>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (l: HeritageLevel) => <Tag color="blue">{HeritageLevelMap[l]}</Tag>,
    },
    { title: '地区', dataIndex: 'region', key: 'region' },
    { title: '浏览量', dataIndex: 'viewCount', key: 'viewCount' },
    {
      title: '状态',
      dataIndex: 'published',
      key: 'published',
      render: (p: boolean) => (p ? <Tag color="green">已发布</Tag> : <Tag color="orange">草稿</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Heritage) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        style={{ borderRadius: 8, marginBottom: 16 }}
        styles={{ body: { padding: 16 } }}
        title={<span style={{ color: '#c8a96e' }}>非遗项目管理</span>}
        extra={
          <Space>
            <Input
              placeholder="搜索项目名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={fetchData}
              style={{ width: 200 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增项目
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page + 1,
            pageSize: size,
            total,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(p - 1)
              setSize(s)
            },
          }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑非遗项目' : '新增非遗项目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="category" label="项目类别" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>
                {Object.entries(HeritageCategoryMap).map(([k, v]) => (
                  <Option key={k} value={k}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="level" label="项目级别" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>
                {Object.entries(HeritageLevelMap).map(([k, v]) => (
                  <Option key={k} value={k}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="region" label="所属地区">
            <Input />
          </Form.Item>
          <Form.Item name="summary" label="项目简介" rules={[{ required: true }]}>
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="description" label="详细介绍">
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="coverImage" label="封面图片URL">
            <Input />
          </Form.Item>
          <Form.Item name="published" label="是否发布" valuePropName="checked">
            <Select>
              <Option value={true}>发布</Option>
              <Option value={false}>草稿</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminHeritages

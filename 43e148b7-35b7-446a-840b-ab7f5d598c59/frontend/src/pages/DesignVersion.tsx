import { useState, useRef } from 'react'
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  message,
  Progress,
  Row,
  Col,
  Descriptions,
  Drawer,
  Tooltip,
  Divider,
  Checkbox,
  Empty,
} from 'antd'
import {
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  SendOutlined,
  DiffOutlined,
  InboxOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { DesignVersion } from '@/types'
import { professionMap, professionColorMap } from '@/utils/enumMap'
import { mockVersions, mockProjects, mockTasks } from '@/utils/mockData'
import dayjs from 'dayjs'

const { Dragger } = Upload

export default function DesignVersionPage() {
  const [versions, setVersions] = useState<DesignVersion[]>(mockVersions)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<DesignVersion | null>(null)
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadForm] = Form.useForm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleViewDetail = (record: DesignVersion) => {
    setCurrentVersion(record)
    setDetailDrawerOpen(true)
  }

  const handleUploadClick = () => {
    uploadForm.resetFields()
    setUploadProgress(0)
    setIsUploading(false)
    setUploadModalOpen(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 200 * 1024 * 1024) {
        message.error('文件大小不能超过200MB')
        return
      }
      uploadForm.setFieldsValue({ fileName: file.name, fileSize: file.size })
      simulateUpload()
    }
  }

  const simulateUpload = () => {
    setIsUploading(true)
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)
          message.success('文件上传成功')
          return 100
        }
        return prev + Math.random() * 20
      })
    }, 300)
  }

  const handleUploadSubmit = async () => {
    try {
      const values = await uploadForm.validateFields()
      if (uploadProgress < 100) {
        message.warning('请等待文件上传完成')
        return
      }
      const taskVersions = versions.filter((v) => v.taskId === values.taskId)
      const versionCount = taskVersions.length
      const newVersion: DesignVersion = {
        id: Math.max(...versions.map((v) => v.id), 0) + 1,
        projectId: mockTasks.find((t) => t.id === values.taskId)?.projectId || 0,
        projectName: mockTasks.find((t) => t.id === values.taskId)?.projectName || '',
        taskId: values.taskId,
        versionNo: `V${Math.floor(versionCount / 10) + 1}.${versionCount % 10}`,
        fileName: values.fileName,
        fileSize: values.fileSize || 0,
        filePath: `/files/projects/${values.projectId}/tasks/${values.taskId}/v${versionCount}.dwg`,
        uploadedBy: 1,
        uploadedByName: '当前用户',
        description: values.description || '',
        isReleased: false,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setVersions([newVersion, ...versions])
      setUploadModalOpen(false)
      message.success('版本创建成功')
    } catch (e) {}
  }

  const handleDownload = (record: DesignVersion) => {
    message.success(`开始下载：${record.fileName}`)
  }

  const handleRelease = (record: DesignVersion) => {
    Modal.confirm({
      title: '确认发布',
      content: `发布版本 ${record.versionNo} 后，客户端将可访问此版本。确定要发布吗？`,
      onOk: () => {
        setVersions(versions.map((v) => (v.id === record.id ? { ...v, isReleased: true } : v)))
        message.success('版本已发布')
      },
    })
  }

  const handleCompare = () => {
    if (compareIds.length !== 2) {
      message.warning('请选择两个版本进行对比')
      return
    }
    setCompareModalOpen(true)
  }

  const rowSelection = {
    selectedRowKeys: compareIds,
    onChange: (keys: React.Key[]) => setCompareIds(keys as number[]),
    getCheckboxProps: () => ({ disabled: false }),
  }

  const columns = [
    {
      title: '版本号',
      dataIndex: 'versionNo',
      width: 100,
      render: (text: string, record: DesignVersion) => (
        <Space>
          <strong style={{ fontSize: 16 }}>{text}</strong>
          {record.isReleased && <Tag color="success">已发布</Tag>}
        </Space>
      ),
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      width: 200,
    },
    {
      title: '文件',
      dataIndex: 'fileName',
      width: 250,
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          <span title={text}>{text}</span>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      width: 100,
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '说明',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '上传人',
      dataIndex: 'uploadedByName',
      width: 100,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: DesignVersion) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            预览
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>
            下载
          </Button>
          {!record.isReleased && (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handleRelease(record)}>
              发布
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>图纸版本管理</div>
          <Space>
            {compareIds.length > 0 && (
              <Button icon={<DiffOutlined />} onClick={handleCompare}>
                版本对比 ({compareIds.length})
              </Button>
            )}
            <Button type="primary" icon={<UploadOutlined />} onClick={handleUploadClick}>
              上传新版本
            </Button>
          </Space>
        </div>

        {compareIds.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: '#e6f4ff', borderRadius: 4 }}>
            已选择 {compareIds.length} 个版本，点击"版本对比"查看差异
            <Button type="link" size="small" onClick={() => setCompareIds([])} style={{ marginLeft: 16 }}>
              清空选择
            </Button>
          </div>
        )}

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={versions}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title="上传新版本"
        open={uploadModalOpen}
        onOk={handleUploadSubmit}
        onCancel={() => setUploadModalOpen(false)}
        width={600}
        okText="提交"
        cancelText="取消"
        confirmLoading={isUploading}
        destroyOnClose
      >
        <Form form={uploadForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
                <Select
                  placeholder="请选择项目"
                  options={mockProjects.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={() => uploadForm.setFieldsValue({ taskId: undefined })}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskId" label="所属任务" rules={[{ required: true, message: '请选择任务' }]}>
                <Select
                  placeholder="请选择任务"
                  options={mockTasks.map((t) => ({ value: t.id, label: t.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="上传文件" required>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept=".dwg,.dxf,.pdf,.doc,.docx"
            />
            <div className="version-upload-area" onClick={() => fileInputRef.current?.click()}>
              <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              <div style={{ marginTop: 12, fontWeight: 'bold' }}>点击或拖拽文件到此处上传</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                支持 DWG、DXF、PDF、Word 等格式，单文件最大 200MB，支持断点续传
              </div>
            </div>
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="fileName" label="文件名" rules={[{ required: true, message: '请选择文件' }]}>
                <Input placeholder="请先选择文件" readOnly />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="fileSize" label="文件大小">
                <Input placeholder="自动" readOnly />
              </Form.Item>
            </Col>
          </Row>

          {isUploading && (
            <div style={{ marginBottom: 16 }}>
              <Progress percent={Math.round(uploadProgress)} status="active" />
            </div>
          )}

          <Form.Item name="description" label="修改说明">
            <Input.TextArea rows={3} placeholder="请描述本次修改内容..." />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="版本详情"
        width={600}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        destroyOnClose
      >
        {currentVersion && (
          <div>
            <div
              style={{
                height: 300,
                background: '#f5f5f5',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ textAlign: 'center', color: '#999' }}>
                <FileTextOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                <div style={{ fontWeight: 'bold' }}>{currentVersion.fileName}</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>图纸在线预览区域</div>
              </div>
            </div>

            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="版本号">{currentVersion.versionNo}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {currentVersion.isReleased ? <Tag color="success">已发布</Tag> : <Tag>草稿</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="所属项目" span={2}>{currentVersion.projectName}</Descriptions.Item>
                <Descriptions.Item label="文件大小">{(currentVersion.fileSize / 1024 / 1024).toFixed(2)} MB</Descriptions.Item>
                <Descriptions.Item label="上传时间">{currentVersion.createdAt}</Descriptions.Item>
                <Descriptions.Item label="上传人" span={2}>
                  <Space>
                    <UserOutlined />
                    {currentVersion.uploadedByName}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="修改说明" span={2}>
                  {currentVersion.description || '无'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Space>
              <Button type="primary" icon={<DownloadOutlined />}>
                下载文件
              </Button>
              {!currentVersion.isReleased && (
                <Button icon={<SendOutlined />} onClick={() => handleRelease(currentVersion)}>
                  发布此版本
                </Button>
              )}
            </Space>
          </div>
        )}
      </Drawer>

      <Modal
        title="版本对比"
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {compareIds.length === 2 ? (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card size="small" title={`版本 1：${versions.find((v) => v.id === compareIds[0])?.versionNo}`}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="文件">
                      {versions.find((v) => v.id === compareIds[0])?.fileName}
                    </Descriptions.Item>
                    <Descriptions.Item label="上传人">
                      {versions.find((v) => v.id === compareIds[0])?.uploadedByName}
                    </Descriptions.Item>
                    <Descriptions.Item label="上传时间">
                      {versions.find((v) => v.id === compareIds[0])?.createdAt}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title={`版本 2：${versions.find((v) => v.id === compareIds[1])?.versionNo}`}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="文件">
                      {versions.find((v) => v.id === compareIds[1])?.fileName}
                    </Descriptions.Item>
                    <Descriptions.Item label="上传人">
                      {versions.find((v) => v.id === compareIds[1])?.uploadedByName}
                    </Descriptions.Item>
                    <Descriptions.Item label="上传时间">
                      {versions.find((v) => v.id === compareIds[1])?.createdAt}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
            <Divider>差异标注</Divider>
            <div
              style={{
                height: 300,
                background: '#f5f5f5',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ textAlign: 'center', color: '#999' }}>
                <DiffOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>图纸差异对比区域</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  <Tag color="green">新增</Tag>
                  <Tag color="red">删除</Tag>
                  <Tag color="orange">修改</Tag>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Empty description="请选择两个版本进行对比" />
        )}
      </Modal>
    </div>
  )
}

import { useState } from 'react'
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
  List,
  Tooltip,
  Avatar,
  Divider,
  message,
  Badge,
  Row,
  Col,
  Drawer,
  InputNumber,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  MessageOutlined,
  PlusOutlined,
  EyeOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { ReviewRecord, ReviewComment, ReviewLevel, ReviewStatus } from '@/types'
import {
  reviewLevelMap,
  reviewStatusMap,
  reviewStatusColorMap,
  professionMap,
  professionColorMap,
} from '@/utils/enumMap'
import { mockReviews, mockTasks, mockProjects } from '@/utils/mockData'
import dayjs from 'dayjs'

export default function ReviewWorkflow() {
  const [reviews, setReviews] = useState<ReviewRecord[]>(mockReviews)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentReview, setCurrentReview] = useState<ReviewRecord | null>(null)
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [currentComment, setCurrentComment] = useState<ReviewComment | null>(null)
  const [commentForm] = Form.useForm()
  const [replyForm] = Form.useForm()

  const handleViewDetail = (record: ReviewRecord) => {
    setCurrentReview(record)
    setDrawerOpen(true)
  }

  const handleAddComment = () => {
    commentForm.resetFields()
    setCommentModalOpen(true)
  }

  const handleCommentSubmit = async () => {
    try {
      const values = await commentForm.validateFields()
      if (currentReview) {
        const newComment: ReviewComment = {
          id: Math.random(),
          reviewRecordId: currentReview.id,
          content: values.content,
          location: values.location,
          resolved: false,
          createdBy: 1,
          createdByName: '当前用户',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        setReviews(
          reviews.map((r) =>
            r.id === currentReview.id ? { ...r, comments: [...r.comments, newComment] } : r
          )
        )
        setCurrentReview({ ...currentReview, comments: [...currentReview.comments, newComment] })
        setCommentModalOpen(false)
        message.success('意见添加成功')
      }
    } catch (e) {}
  }

  const handleReply = (comment: ReviewComment) => {
    setCurrentComment(comment)
    replyForm.resetFields()
    setReplyModalOpen(true)
  }

  const handleReplySubmit = async () => {
    try {
      const values = await replyForm.validateFields()
      if (currentReview && currentComment) {
        const updatedComments = currentReview.comments.map((c) =>
          c.id === currentComment.id
            ? { ...c, reply: values.reply, repliedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
            : c
        )
        setReviews(
          reviews.map((r) => (r.id === currentReview.id ? { ...r, comments: updatedComments } : r))
        )
        setCurrentReview({ ...currentReview, comments: updatedComments })
        setReplyModalOpen(false)
        message.success('回复成功')
      }
    } catch (e) {}
  }

  const handleResolve = (comment: ReviewComment) => {
    if (currentReview) {
      const updatedComments = currentReview.comments.map((c) =>
        c.id === comment.id ? { ...c, resolved: !c.resolved } : c
      )
      setReviews(
        reviews.map((r) => (r.id === currentReview.id ? { ...r, comments: updatedComments } : r))
      )
      setCurrentReview({ ...currentReview, comments: updatedComments })
      message.success(comment.resolved ? '已取消标记' : '已标记为已解决')
    }
  }

  const handleCompleteReview = (passed: boolean) => {
    if (currentReview) {
      const newStatus: ReviewStatus = passed ? 'PASSED' : 'REJECTED'
      setReviews(
        reviews.map((r) =>
          r.id === currentReview.id
            ? { ...r, status: newStatus, completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
            : r
        )
      )
      setDrawerOpen(false)
      message.success(passed ? '校审通过' : '校审已驳回')
    }
  }

  const columns = [
    {
      title: '校审ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '项目',
      dataIndex: 'projectId',
      width: 200,
      render: (id: number) => mockProjects.find((p) => p.id === id)?.name || '-',
    },
    {
      title: '任务',
      dataIndex: 'taskId',
      width: 200,
      render: (id: number) => mockTasks.find((t) => t.id === id)?.name || '-',
    },
    {
      title: '校审级别',
      dataIndex: 'level',
      width: 100,
      render: (level: ReviewLevel) => reviewLevelMap[level],
    },
    {
      title: '校审人',
      dataIndex: 'reviewerName',
      width: 100,
    },
    {
      title: '意见数',
      width: 100,
      render: (_: any, record: ReviewRecord) => (
        <Badge count={record.comments.filter((c) => !c.resolved).length} showZero />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: ReviewStatus) => (
        <Tag color={reviewStatusColorMap[status]}>{reviewStatusMap[status]}</Tag>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ReviewRecord) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>校审记录列表</div>
          <Button type="primary" icon={<PlusOutlined />}>
            发起校审
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={reviews}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Drawer
        title={`校审详情 - ${reviewLevelMap[currentReview?.level || 'CHECK']}`}
        width={900}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          currentReview?.status === 'IN_PROGRESS' && (
            <Space>
              <Button icon={<CloseCircleOutlined />} danger onClick={() => handleCompleteReview(false)}>
                驳回
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleCompleteReview(true)}>
                通过
              </Button>
            </Space>
          )
        }
      >
        {currentReview && (
          <div>
            <Card style={{ marginBottom: 16 }} size="small">
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ color: '#999' }}>项目</div>
                  <div style={{ fontWeight: 'bold' }}>
                    {mockProjects.find((p) => p.id === currentReview.projectId)?.name}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#999' }}>任务</div>
                  <div style={{ fontWeight: 'bold' }}>
                    {mockTasks.find((t) => t.id === currentReview.taskId)?.name}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#999' }}>状态</div>
                  <Tag color={reviewStatusColorMap[currentReview.status]}>
                    {reviewStatusMap[currentReview.status]}
                  </Tag>
                </Col>
              </Row>
            </Card>

            <div className="review-layout" style={{ marginBottom: 16 }}>
              <div className="review-drawing">
                <div style={{ textAlign: 'center', color: '#999' }}>
                  <FileTextOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                  <div>图纸预览区域</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>支持在线标注与缩放查看</div>
                </div>
              </div>
              <div className="review-comments">
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #e8e8e8',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    <MessageOutlined /> 校审意见 ({currentReview.comments.length})
                  </span>
                  {currentReview.status !== 'PASSED' && currentReview.status !== 'REJECTED' && (
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddComment}>
                      添加意见
                    </Button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                  {currentReview.comments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无校审意见</div>
                  ) : (
                    <List
                      dataSource={currentReview.comments}
                      renderItem={(comment) => (
                        <div
                          key={comment.id}
                          style={{
                            padding: 12,
                            marginBottom: 8,
                            background: comment.resolved ? '#f6ffed' : '#fff',
                            border: `1px solid ${comment.resolved ? '#b7eb8f' : '#e8e8e8'}`,
                            borderRadius: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <Avatar icon={<UserOutlined />} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Space>
                                  <span style={{ fontWeight: 'bold' }}>{comment.createdByName}</span>
                                  {comment.resolved && (
                                    <Tag color="success" icon={<CheckCircleOutlined />}>
                                      已解决
                                    </Tag>
                                  )}
                                </Space>
                                <span style={{ color: '#999', fontSize: 12 }}>{comment.createdAt}</span>
                              </div>
                              <div style={{ marginBottom: 8 }}>
                                {comment.location && (
                                  <div style={{ color: '#1677ff', marginBottom: 4, fontSize: 12 }}>
                                    <EnvironmentOutlined /> {comment.location}
                                  </div>
                                )}
                                <p style={{ marginBottom: 8 }}>{comment.content}</p>
                                {comment.reply && (
                                  <div
                                    style={{
                                      padding: 8,
                                      background: '#f5f5f5',
                                      borderRadius: 4,
                                      borderLeft: '3px solid #1677ff',
                                    }}
                                  >
                                    <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                                      设计师回复：{comment.repliedAt}
                                    </div>
                                    {comment.reply}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {currentReview.status !== 'PASSED' && currentReview.status !== 'REJECTED' && (
                                  <>
                                    {!comment.reply && (
                                      <Button type="link" size="small" onClick={() => handleReply(comment)}>
                                        回复
                                      </Button>
                                    )}
                                    <Tooltip title={comment.resolved ? '取消标记' : '标记已解决'}>
                                      <Button
                                        type="link"
                                        size="small"
                                        onClick={() => handleResolve(comment)}
                                      >
                                        {comment.resolved ? '取消解决' : '标记解决'}
                                      </Button>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title="添加校审意见"
        open={commentModalOpen}
        onOk={handleCommentSubmit}
        onCancel={() => setCommentModalOpen(false)}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={commentForm} layout="vertical">
          <Form.Item name="location" label="标注位置">
            <Input placeholder="请输入位置（如：基础平面图 1-A轴交3轴）" prefix={<EnvironmentOutlined />} />
          </Form.Item>
          <Form.Item name="content" label="意见内容" rules={[{ required: true, message: '请输入意见内容' }]}>
            <Input.TextArea rows={4} placeholder="请详细描述问题..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="回复校审意见"
        open={replyModalOpen}
        onOk={handleReplySubmit}
        onCancel={() => setReplyModalOpen(false)}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        {currentComment && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{currentComment.createdByName} 的意见：</div>
            {currentComment.location && (
              <div style={{ color: '#1677ff', fontSize: 12, marginBottom: 4 }}>
                <EnvironmentOutlined /> {currentComment.location}
              </div>
            )}
            <div>{currentComment.content}</div>
          </div>
        )}
        <Form form={replyForm} layout="vertical">
          <Form.Item name="reply" label="回复内容" rules={[{ required: true, message: '请输入回复内容' }]}>
            <Input.TextArea rows={4} placeholder="请描述修改情况..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

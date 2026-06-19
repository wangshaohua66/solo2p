import { useState, useEffect } from 'react'
import {
  Card,
  List,
  Tag,
  Button,
  Tabs,
  Empty,
  Badge,
  Space,
  message,
  Modal
} from 'antd'
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  SettingOutlined,
  MailOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  NotificationOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Message } from '@/types'
import { mockGetMessageList, mockMarkAsRead, mockMarkAllAsRead } from '@/mock/message'
import './Index.css'

const { TabPane } = Tabs
const { confirm } = Modal

const MessageCenter = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    loadMessages()
  }, [activeTab, page, pageSize])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const result: any = await mockGetMessageList({
        page,
        pageSize,
        type: activeTab === 'all' ? undefined : activeTab
      })
      setMessages(result.list)
      setTotal(result.total)
      
      const unreadResult: any = await mockGetMessageList({ isRead: false })
      setUnreadCount(unreadResult.total || 0)
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: Message['type']) => {
    const map: Record<string, { icon: React.ReactNode; color: string }> = {
      system: { icon: <NotificationOutlined />, color: '#1677ff' },
      application: { icon: <FileTextOutlined />, color: '#52c41a' },
      interview: { icon: <VideoCameraOutlined />, color: '#fa8c16' },
      notification: { icon: <BellOutlined />, color: '#722ed1' }
    }
    return map[type] || map.system
  }

  const getTypeName = (type: Message['type']) => {
    const map: Record<string, string> = {
      system: '系统通知',
      application: '投递通知',
      interview: '面试通知',
      notification: '活动通知'
    }
    return map[type] || '其他'
  }

  const handleMarkRead = async (id: string) => {
    await mockMarkAsRead(id)
    message.success('已标记为已读')
    loadMessages()
  }

  const handleMarkAllRead = async () => {
    await mockMarkAllAsRead()
    message.success('全部已读')
    loadMessages()
  }

  const handleDelete = (id: string) => {
    confirm({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      onOk: () => {
        message.success('删除成功')
        loadMessages()
      }
    })
  }

  const handleMessageClick = (msg: Message) => {
    if (!msg.isRead) {
      handleMarkRead(msg.id)
    }
    if (msg.relatedId) {
      if (msg.type === 'application') {
        navigate('/applications')
      } else if (msg.type === 'interview') {
        navigate('/interviews')
      }
    }
  }

  const tabItems = [
    { key: 'all', label: <span>全部消息 <Badge count={unreadCount} size="small" style={{ marginLeft: 4 }} /></span> },
    { key: 'system', label: '系统通知' },
    { key: 'application', label: '投递通知' },
    { key: 'interview', label: '面试通知' },
    { key: 'notification', label: '活动通知' }
  ]

  return (
    <div className="message-center-page">
      <Card className="message-header">
        <div className="header-left">
          <h2><BellOutlined /> 消息中心</h2>
          <span className="unread-tip">您有 {unreadCount} 条未读消息</span>
        </div>
        <Space>
          <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            全部已读
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
            消息设置
          </Button>
        </Space>
      </Card>

      <Card className="message-content">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        
        {messages.length > 0 ? (
          <List
            loading={loading}
            dataSource={messages}
            renderItem={(msg) => {
              const typeInfo = getTypeIcon(msg.type)
              return (
                <List.Item
                  className={`message-item ${msg.isRead ? '' : 'unread'}`}
                  onClick={() => handleMessageClick(msg)}
                  actions={[
                    !msg.isRead && (
                      <Button type="link" size="small" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); handleMarkRead(msg.id); }}>
                        标为已读
                      </Button>
                    ),
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }}>
                      删除
                    </Button>
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <div className="msg-avatar" style={{ background: typeInfo.color + '15', color: typeInfo.color }}>
                        {typeInfo.icon}
                      </div>
                    }
                    title={
                      <div className="msg-title">
                        {!msg.isRead && <span className="unread-dot"></span>}
                        {msg.title}
                        <Tag color={typeInfo.color} style={{ marginLeft: 8 }}>{getTypeName(msg.type)}</Tag>
                      </div>
                    }
                    description={
                      <div className="msg-desc">
                        <p className="msg-content">{msg.content}</p>
                        <span className="msg-time">{msg.createdAt}</span>
                      </div>
                    }
                  />
                </List.Item>
              )
            }}
          />
        ) : (
          <Empty description="暂无消息" style={{ padding: 40 }} />
        )}
      </Card>
    </div>
  )
}

export default MessageCenter

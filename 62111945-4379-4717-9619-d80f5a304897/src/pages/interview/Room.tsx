import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Row,
  Col,
  Statistic,
  Tooltip,
  Rate
} from 'antd'
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  PhoneOutlined,
  DesktopOutlined,
  MessageOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SettingOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { Interview } from '@/types'
import { mockGetInterviewDetail, mockJoinInterview } from '@/mock/interview'
import './Room.css'

const InterviewRoom = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [isJoined, setIsJoined] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [chatVisible, setChatVisible] = useState(false)
  const [duration, setDuration] = useState(0)
  const [endModalVisible, setEndModalVisible] = useState(false)
  const [rating, setRating] = useState(0)
  const [evaluation, setEvaluation] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (id) {
      loadInterview()
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [id])

  const loadInterview = async () => {
    setLoading(true)
    try {
      const detail = await mockGetInterviewDetail(id!)
      setInterview(detail)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    try {
      await mockJoinInterview(interview?.roomId || '')
      setIsJoined(true)
      message.success('已加入面试')
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)
    } catch (error: any) {
      message.error(error.message || '加入失败')
    }
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleToggleVideo = () => {
    setVideoEnabled(!videoEnabled)
    message.info(videoEnabled ? '摄像头已关闭' : '摄像头已开启')
  }

  const handleToggleAudio = () => {
    setAudioEnabled(!audioEnabled)
    message.info(audioEnabled ? '麦克风已静音' : '麦克风已开启')
  }

  const handleScreenShare = () => {
    setScreenSharing(!screenSharing)
    message.info(screenSharing ? '已停止屏幕共享' : '已开始屏幕共享')
  }

  const handleEndInterview = () => {
    setEndModalVisible(true)
  }

  const confirmEndInterview = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    message.success('面试已结束')
    setEndModalVisible(false)
    navigate('/interviews')
  }

  if (!interview && !loading) {
    return (
      <Card>
        <Empty description="面试不存在" />
      </Card>
    )
  }

  return (
    <div className="interview-room-page">
      <div className="room-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <div className="room-title">
          <VideoCameraOutlined />
          <span>{interview?.jobTitle} - 视频面试</span>
          <Tag color="blue">{interview?.status === 'confirmed' ? '待开始' : '进行中'}</Tag>
        </div>
        <div className="room-info">
          <ClockCircleOutlined /> {formatDuration(duration)}
        </div>
      </div>

      <div className="room-content">
        <div className="video-container">
          <div className="main-video">
            {isJoined ? (
              <div className="video-placeholder">
                <img 
                  src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20business%20person%20in%20video%20call%20interview%20modern%20office%20background&image_size=landscape_16_9"
                  alt="远程面试者"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div className="video-overlay">
                  <span className="participant-name">{interview?.jobseekerName || '面试官'}</span>
                  <span className="connection-status">
                    <span className="status-dot online"></span>
                    在线
                  </span>
                </div>
              </div>
            ) : (
              <div className="waiting-room">
                <div className="waiting-icon">
                  <VideoCameraOutlined />
                </div>
                <h3>准备加入面试</h3>
                <p>请确保摄像头和麦克风正常工作</p>
                <div className="device-check">
                  <div className={`device-item ${videoEnabled ? 'ok' : 'off'}`}>
                    <VideoCameraOutlined /> 摄像头 {videoEnabled ? '正常' : '关闭'}
                  </div>
                  <div className={`device-item ${audioEnabled ? 'ok' : 'off'}`}>
                    <AudioOutlined /> 麦克风 {audioEnabled ? '正常' : '静音'}
                  </div>
                </div>
                <Button type="primary" size="large" onClick={handleJoin}>
                  加入面试
                </Button>
              </div>
            )}
          </div>

          {isJoined && (
            <div className="self-video">
              <div className="video-placeholder self">
                <img 
                  src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=young%20asian%20professional%20person%20video%20interview%20self%20view&image_size=square"
                  alt="自己"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div className="video-overlay small">
                  <span className="participant-name">我</span>
                </div>
              </div>
            </div>
          )}

          {screenSharing && (
            <div className="screen-share-overlay">
              <DesktopOutlined /> 正在共享屏幕
            </div>
          )}
        </div>

        {chatVisible && (
          <div className="chat-panel">
            <div className="chat-header">
              <MessageOutlined /> 面试聊天
            </div>
            <div className="chat-content">
              <div className="chat-message other">
                <div className="msg-name">面试官</div>
                <div className="msg-bubble">您好，请先做一下自我介绍吧</div>
                <div className="msg-time">14:05</div>
              </div>
              <div className="chat-message self">
                <div className="msg-name">我</div>
                <div className="msg-bubble">好的，我叫王小明，毕业于北京大学计算机专业...</div>
                <div className="msg-time">14:06</div>
              </div>
            </div>
            <div className="chat-input">
              <input type="text" placeholder="输入消息..." />
              <Button type="primary">发送</Button>
            </div>
          </div>
        )}
      </div>

      {isJoined && (
        <div className="control-bar">
          <Space size="middle">
            <Tooltip title={videoEnabled ? '关闭摄像头' : '开启摄像头'}>
              <Button
                shape="circle"
                size="large"
                icon={<VideoCameraOutlined />}
                onClick={handleToggleVideo}
                type={videoEnabled ? 'default' : 'primary'}
                danger={!videoEnabled}
              />
            </Tooltip>
            <Tooltip title={audioEnabled ? '静音麦克风' : '开启麦克风'}>
              <Button
                shape="circle"
                size="large"
                icon={<AudioOutlined />}
                onClick={handleToggleAudio}
                type={audioEnabled ? 'default' : 'primary'}
                danger={!audioEnabled}
              />
            </Tooltip>
            <Tooltip title={screenSharing ? '停止共享' : '共享屏幕'}>
              <Button
                shape="circle"
                size="large"
                icon={<DesktopOutlined />}
                onClick={handleScreenShare}
                type={screenSharing ? 'primary' : 'default'}
              />
            </Tooltip>
            <Tooltip title="聊天">
              <Button
                shape="circle"
                size="large"
                icon={<MessageOutlined />}
                onClick={() => setChatVisible(!chatVisible)}
                type={chatVisible ? 'primary' : 'default'}
              />
            </Tooltip>
            <Tooltip title="设置">
              <Button
                shape="circle"
                size="large"
                icon={<SettingOutlined />}
                onClick={() => message.info('设置功能')}
              />
            </Tooltip>
          </Space>
          <Button
            type="primary"
            danger
            icon={<PhoneOutlined />}
            size="large"
            onClick={handleEndInterview}
          >
            结束面试
          </Button>
        </div>
      )}

      {!isJoined && (
        <div className="room-footer">
          <Card className="info-card">
            <Row gutter={24}>
              <Col span={8}>
                <Statistic title="面试职位" value={interview?.jobTitle} />
              </Col>
              <Col span={8}>
                <Statistic title="面试时长" value={`${interview?.duration} 分钟`} />
              </Col>
              <Col span={8}>
                <Statistic title="面试类型" value="视频面试" />
              </Col>
            </Row>
          </Card>
        </div>
      )}

      <Modal
        title="结束面试"
        open={endModalVisible}
        onCancel={() => setEndModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEndModalVisible(false)}>
            取消
          </Button>,
          <Button key="confirm" type="primary" danger onClick={confirmEndInterview}>
            确认结束
          </Button>
        ]}
      >
        <p>确定要结束本次面试吗？</p>
        <p style={{ color: '#8c8c8c', fontSize: 12 }}>面试时长：{formatDuration(duration)}</p>
      </Modal>
    </div>
  )
}

export default InterviewRoom

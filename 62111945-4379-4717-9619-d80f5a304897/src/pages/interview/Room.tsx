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
  Rate,
  Input,
  Alert,
  Empty,
  Spin
} from 'antd'
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  PhoneOutlined,
  PhoneFilled,
  DesktopOutlined,
  MessageOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { Interview } from '@/types'
import { mockGetInterviewDetail, mockJoinInterview } from '@/mock/interview'
import { useWebRTC } from '@/hooks/useWebRTC'
import './Room.css'

const { TextArea } = Input

interface ChatMessage {
  id: string
  from: string
  fromName: string
  content: string
  timestamp: number
  isSelf: boolean
}

const InterviewRoom = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [isJoined, setIsJoined] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [duration, setDuration] = useState(0)
  const [endModalVisible, setEndModalVisible] = useState(false)
  const [rating, setRating] = useState(0)
  const [evaluation, setEvaluation] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      from: 'interviewer',
      fromName: '面试官',
      content: '您好，请先做一下自我介绍吧',
      timestamp: Date.now() - 300000,
      isSelf: false
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [deviceError, setDeviceError] = useState<string | null>(null)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const webrtc = useWebRTC()

  useEffect(() => {
    if (id) {
      loadInterview()
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      webrtc.leaveRoom()
    }
  }, [id])

  useEffect(() => {
    if (webrtc.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = webrtc.localStream
      localVideoRef.current.muted = true
    }
  }, [webrtc.localStream])

  useEffect(() => {
    const remoteVideos = document.querySelectorAll('.remote-video-element')
    remoteVideos.forEach(el => {
      const videoEl = el as HTMLVideoElement
      const userId = videoEl.dataset.userId
      const stream = webrtc.remoteStreams.get(userId || '')
      if (stream && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream
      }
    })
  }, [webrtc.remoteStreams, isJoined])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  useEffect(() => {
    if (webrtc.error && isJoined) {
      setDeviceError(webrtc.error)
    }
  }, [webrtc.error, isJoined])

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
      setDeviceError(null)
      await webrtc.startLocalStream()
      webrtc.joinRoom()
      setIsJoined(true)
      setIsInitialized(true)
      message.success('已加入面试，音视频已连接')
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)
    } catch (error: any) {
      console.error('[Interview] 加入失败:', error)
      setDeviceError(error.message || '无法访问摄像头和麦克风，请检查浏览器权限设置')
      Modal.confirm({
        title: '设备权限问题',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>{error.message || '无法访问您的摄像头或麦克风。'}</p>
            <p style={{ color: '#8c8c8c', fontSize: 12 }}>
              请确保：<br />
              1. 已连接摄像头和麦克风设备<br />
              2. 浏览器已授权访问媒体设备<br />
              3. 设备未被其他应用占用
            </p>
          </div>
        ),
        okText: '重试',
        cancelText: '取消',
        onOk: handleJoin
      })
    }
  }

  const handleReinitializeDevices = async () => {
    try {
      setDeviceError(null)
      await webrtc.startLocalStream()
      message.success('设备重新初始化成功')
    } catch (error: any) {
      setDeviceError(error.message)
    }
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleToggleVideo = () => {
    webrtc.toggleVideo()
    message.info(webrtc.isVideoEnabled ? '摄像头已关闭' : '摄像头已开启')
  }

  const handleToggleAudio = () => {
    webrtc.toggleAudio()
    message.info(webrtc.isAudioEnabled ? '麦克风已静音' : '麦克风已开启')
  }

  const handleScreenShare = async () => {
    if (webrtc.isScreenSharing) {
      webrtc.stopScreenShare()
      message.info('已停止屏幕共享')
    } else {
      try {
        await webrtc.startScreenShare()
        message.info('已开始屏幕共享')
      } catch (err: any) {
        message.error(err.message || '屏幕共享失败')
      }
    }
  }

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      from: 'me',
      fromName: '我',
      content: chatInput.trim(),
      timestamp: Date.now(),
      isSelf: true
    }
    
    setChatMessages(prev => [...prev, newMessage])
    webrtc.sendChatMessage(chatInput.trim())
    setChatInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleEndInterview = () => {
    setEndModalVisible(true)
  }

  const confirmEndInterview = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    webrtc.leaveRoom()
    message.success('面试已结束')
    setEndModalVisible(false)
    navigate('/interviews')
  }

  const getConnectionStatusText = () => {
    switch (webrtc.connectionState) {
      case 'connected': return { text: '已连接', color: 'green' }
      case 'connecting': return { text: '连接中...', color: 'orange' }
      case 'disconnected': return { text: '已断开', color: 'red' }
      case 'failed': return { text: '连接失败', color: 'red' }
      default: return { text: '未连接', color: 'gray' }
    }
  }

  const getRemoteParticipants = () => {
    const participants: { id: string; name: string }[] = []
    webrtc.remoteStreams.forEach((_, id) => {
      participants.push({ 
        id, 
        name: interview?.jobseekerName || `用户${id.slice(-4)}` 
      })
    })
    
    if (participants.length === 0 && isJoined) {
      participants.push({ 
        id: 'interviewer-placeholder', 
        name: interview?.jobseekerName || '面试官' 
      })
    }
    
    return participants
  }

  const connectionStatus = getConnectionStatusText()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!interview) {
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
          <span>{interview.jobTitle} - 视频面试</span>
          <Tag color="blue">{isJoined ? '进行中' : '待开始'}</Tag>
          {isJoined && (
            <Tag color={connectionStatus.color}>
              <span className={`status-dot ${connectionStatus.color}`}></span>
              {connectionStatus.text}
            </Tag>
          )}
        </div>
        <div className="room-info">
          <ClockCircleOutlined /> {formatDuration(duration)}
        </div>
      </div>

      {deviceError && (
        <div style={{ padding: '8px 16px' }}>
          <Alert
            message="设备异常"
            description={deviceError}
            type="warning"
            showIcon
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={handleReinitializeDevices}>
                重试
              </Button>
            }
            closable
            onClose={() => setDeviceError(null)}
          />
        </div>
      )}

      <div className="room-content">
        <div className="video-container">
          {!isJoined ? (
            <div className="waiting-room">
              <div className="waiting-icon">
                <VideoCameraOutlined />
              </div>
              <h3>准备加入面试</h3>
              <p>请确保摄像头和麦克风正常工作</p>
              
              <div className="device-preview">
                <video 
                  ref={localVideoRef}
                  autoPlay 
                  playsInline
                  muted
                  className="preview-video"
                />
                <div className="preview-overlay">
                  <span className="preview-label">摄像头预览</span>
                </div>
              </div>

              <div className="device-check">
                <div className={`device-item ${webrtc.isVideoEnabled ? 'ok' : 'off'}`}>
                  <VideoCameraOutlined /> 摄像头 {webrtc.isVideoEnabled ? '正常' : '关闭'}
                </div>
                <div className={`device-item ${webrtc.isAudioEnabled ? 'ok' : 'off'}`}>
                  <AudioOutlined /> 麦克风 {webrtc.isAudioEnabled ? '正常' : '静音'}
                </div>
              </div>
              
              <Space>
                <Button icon={<VideoCameraOutlined />} onClick={handleToggleVideo}>
                  {webrtc.isVideoEnabled ? '关闭摄像头' : '开启摄像头'}
                </Button>
                <Button icon={<AudioOutlined />} onClick={handleToggleAudio}>
                  {webrtc.isAudioEnabled ? '静音麦克风' : '开启麦克风'}
                </Button>
              </Space>

              <Button type="primary" size="large" icon={<PhoneFilled />} onClick={handleJoin}>
                加入面试
              </Button>
            </div>
          ) : (
            <>
              <div className="main-video-wrapper">
                {getRemoteParticipants().length === 0 ? (
                  <div className="waiting-participant">
                    <UserOutlined style={{ fontSize: 80, color: '#d9d9d9' }} />
                    <p>等待面试官加入...</p>
                  </div>
                ) : (
                  getRemoteParticipants().map((participant) => (
                    <div key={participant.id} className="main-video">
                      {webrtc.remoteStreams.has(participant.id) ? (
                        <video
                          ref={(el) => {
                            if (el) {
                              remoteVideoRefs.current.set(participant.id, el)
                              el.className = 'remote-video-element'
                              el.dataset.userId = participant.id
                              const stream = webrtc.remoteStreams.get(participant.id)
                              if (stream) el.srcObject = stream
                            }
                          }}
                          autoPlay
                          playsInline
                          className="video-real"
                        />
                      ) : (
                        <div className="video-placeholder no-stream">
                          <UserOutlined style={{ fontSize: 60, color: '#bfbfbf' }} />
                        </div>
                      )}
                      <div className="video-overlay">
                        <span className="participant-name">{participant.name}</span>
                        <span className="connection-status">
                          <span className={`status-dot ${connectionStatus.color}`}></span>
                          {webrtc.remoteStreams.has(participant.id) ? '视频已连接' : '等待视频流'}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                {webrtc.isScreenSharing && (
                  <div className="screen-share-indicator">
                    <DesktopOutlined /> 正在共享屏幕
                  </div>
                )}
              </div>

              <div className="self-video">
                <div className={`video-wrapper self ${!webrtc.isVideoEnabled ? 'video-off' : ''}`}>
                  {webrtc.localStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="video-real self-video-element"
                    />
                  ) : (
                    <div className="video-placeholder">
                      <UserOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
                    </div>
                  )}
                  {!webrtc.isVideoEnabled && (
                    <div className="video-off-overlay">
                      <VideoCameraAddOutlined style={{ fontSize: 24 }} />
                      <span>摄像头已关闭</span>
                    </div>
                  )}
                  {!webrtc.isAudioEnabled && (
                    <div className="audio-off-badge">
                      <AudioMutedOutlined />
                    </div>
                  )}
                  <div className="video-overlay small">
                    <span className="participant-name">我</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {isJoined && (
          <div className="chat-panel">
            <div className="chat-header">
              <MessageOutlined /> 面试聊天
            </div>
            <div className="chat-content" ref={chatContainerRef}>
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.isSelf ? 'self' : 'other'}`}>
                  <div className="msg-name">{msg.fromName}</div>
                  <div className="msg-bubble">{msg.content}</div>
                  <div className="msg-time">{dayjs(msg.timestamp).format('HH:mm')}</div>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <TextArea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入消息（Enter发送）..."
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
              <Button 
                type="primary" 
                icon={<SendOutlined />} 
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
              >
                发送
              </Button>
            </div>
          </div>
        )}
      </div>

      {isJoined && (
        <div className="control-bar">
          <Space size="middle">
            <Tooltip title={webrtc.isVideoEnabled ? '关闭摄像头' : '开启摄像头'}>
              <Button
                shape="circle"
                size="large"
                icon={webrtc.isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                onClick={handleToggleVideo}
                type={webrtc.isVideoEnabled ? 'default' : 'primary'}
                danger={!webrtc.isVideoEnabled}
              />
            </Tooltip>
            <Tooltip title={webrtc.isAudioEnabled ? '静音麦克风' : '开启麦克风'}>
              <Button
                shape="circle"
                size="large"
                icon={webrtc.isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                onClick={handleToggleAudio}
                type={webrtc.isAudioEnabled ? 'default' : 'primary'}
                danger={!webrtc.isAudioEnabled}
              />
            </Tooltip>
            <Tooltip title={webrtc.isScreenSharing ? '停止共享' : '共享屏幕'}>
              <Button
                shape="circle"
                size="large"
                icon={<DesktopOutlined />}
                onClick={handleScreenShare}
                type={webrtc.isScreenSharing ? 'primary' : 'default'}
              />
            </Tooltip>
            <Tooltip title="设置">
              <Button
                shape="circle"
                size="large"
                icon={<SettingOutlined />}
                onClick={() => message.info('设备设置功能开发中')}
              />
            </Tooltip>
          </Space>
          
          <div className="control-info">
            {webrtc.isScreenSharing && <Tag color="purple">屏幕共享中</Tag>}
            {!webrtc.isAudioEnabled && <Tag color="orange">麦克风静音</Tag>}
            {!webrtc.isVideoEnabled && <Tag color="orange">摄像头关闭</Tag>}
            <span className="participant-count">
              <UserOutlined /> {webrtc.remoteStreams.size + 1} 人在线
            </span>
          </div>

          <Button
            type="primary"
            danger
            icon={<PhoneFilled />}
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
                <Statistic title="面试职位" value={interview.jobTitle} />
              </Col>
              <Col span={8}>
                <Statistic title="面试时长" value={`${interview.duration} 分钟`} />
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
        <div style={{ marginBottom: 16 }}>
          <p>确定要结束本次面试吗？</p>
          <p style={{ color: '#8c8c8c', fontSize: 12 }}>面试时长：{formatDuration(duration)}</p>
        </div>
        
        <div>
          <div style={{ marginBottom: 8 }}>
            面试评价：<Rate onChange={setRating} value={rating} />
          </div>
          <TextArea
            rows={4}
            placeholder="请填写面试评价..."
            value={evaluation}
            onChange={(e) => setEvaluation(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

export default InterviewRoom

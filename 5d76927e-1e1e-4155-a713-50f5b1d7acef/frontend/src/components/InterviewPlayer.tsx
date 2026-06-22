import React, { useState } from 'react'
import { Card, Typography, Tag, Button, Space, Timeline, Divider, Descriptions, Avatar } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { MediaFile, InterviewMetadata } from '@/types'

const { Title, Paragraph, Text } = Typography

interface InterviewPlayerProps {
  media: MediaFile
}

const InterviewPlayer: React.FC<InterviewPlayerProps> = ({ media }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [expandedTranscript, setExpandedTranscript] = useState(false)

  const meta = (media.metadata || {}) as unknown as InterviewMetadata
  const transcript = meta.transcript || media.description || ''
  const highlights = meta.highlights || []
  const duration = meta.duration || ''
  const interviewer = meta.interviewer || '未知'
  const interviewee = meta.interviewee || '未知'
  const interviewDate = meta.interviewDate || ''
  const location = meta.location || ''

  return (
    <Card
      style={{
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(22, 33, 62, 0.9), rgba(15, 52, 96, 0.6))',
        border: '1px solid rgba(200, 169, 110, 0.2)',
      }}
      styles={{ body: { padding: 24 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Space align="center" size={12}>
            <Tag color="gold" style={{ fontSize: 13, padding: '4px 10px' }}>
              <MessageOutlined /> 访谈录
            </Tag>
            <Title level={4} style={{ color: '#c8a96e', margin: 0 }}>{media.fileName}</Title>
          </Space>
        </div>
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ background: isPlaying ? '#e74c3c' : '#c8a96e', borderColor: isPlaying ? '#e74c3c' : '#c8a96e', width: 48, height: 48 }}
        />
      </div>

      <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item
          label={<span style={{ color: '#a0a0a0' }}><UserOutlined /> 访谈人</span>}
          contentStyle={{ color: '#e8e8e8' }}
        >
          {interviewer}
        </Descriptions.Item>
        <Descriptions.Item
          label={<span style={{ color: '#a0a0a0' }}><UserOutlined /> 受访人</span>}
          contentStyle={{ color: '#e8e8e8' }}
        >
          <Tag color="gold">{interviewee}</Tag>
        </Descriptions.Item>
        <Descriptions.Item
          label={<span style={{ color: '#a0a0a0' }}><CalendarOutlined /> 访谈日期</span>}
          contentStyle={{ color: '#e8e8e8' }}
        >
          {interviewDate || '未知'}
        </Descriptions.Item>
        <Descriptions.Item
          label={<span style={{ color: '#a0a0a0' }}><EnvironmentOutlined /> 访谈地点</span>}
          contentStyle={{ color: '#e8e8e8' }}
        >
          {location || '未知'}
        </Descriptions.Item>
      </Descriptions>

      {duration && (
        <div style={{ color: '#a0a0a0', fontSize: 12, marginBottom: 12 }}>
          <ClockCircleOutlined /> 时长: {duration}
        </div>
      )}

      {isPlaying && (
        <div
          style={{
            background: 'rgba(200, 169, 110, 0.1)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <PlayCircleOutlined style={{ color: '#c8a96e', fontSize: 20 }} />
          <div style={{ flex: 1, height: 4, background: 'rgba(200, 169, 110, 0.2)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '35%', background: '#c8a96e', borderRadius: 2 }} />
          </div>
          <Text style={{ color: '#c8a96e', fontSize: 12 }}>05:23 / 15:30</Text>
        </div>
      )}

      {highlights.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#c8a96e', fontSize: 13, fontWeight: 600 }}>精彩片段</Text>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {highlights.map((h, i) => (
              <Tag key={i} color="gold" style={{ cursor: 'pointer' }}>
                🔖 {h}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {transcript && (
        <>
          <Divider style={{ borderColor: 'rgba(200, 169, 110, 0.2)', margin: '16px 0' }} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#c8a96e', fontSize: 13, fontWeight: 600 }}>访谈记录</Text>
              <Button type="link" size="small" style={{ color: '#c8a96e' }} onClick={() => setExpandedTranscript(!expandedTranscript)}>
                {expandedTranscript ? '收起' : '展开全文'}
              </Button>
            </div>
            <Paragraph
              style={{ color: '#c8c8c8', lineHeight: 2, fontSize: 14 }}
              ellipsis={!expandedTranscript ? { rows: 4, expandable: false } : undefined}
            >
              {transcript}
            </Paragraph>
          </div>
        </>
      )}
    </Card>
  )
}

export default InterviewPlayer

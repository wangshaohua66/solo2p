import React, { useState } from 'react'
import { Button, Dropdown, Modal, QRCode, message, Typography } from 'antd'
import {
  ShareAltOutlined,
  WechatOutlined,
  WeiboOutlined,
  LinkOutlined,
  QrcodeOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import axios from 'axios'

const { Text, Paragraph } = Typography

interface SocialShareProps {
  type: 'heritage' | 'inheritor'
  targetId: string
  title?: string
}

const SocialShare: React.FC<SocialShareProps> = ({ type, targetId, title }) => {
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [shareInfo, setShareInfo] = useState<{
    title: string
    description: string
    url: string
    imageUrl: string
    weiboShareUrl?: string
    wechatConfig?: Record<string, unknown>
  } | null>(null)

  const fetchShareInfo = async () => {
    try {
      const res = await axios.get(`/api/share/${type}/${targetId}`)
      setShareInfo(res.data?.data || null)
    } catch {
      setShareInfo(null)
    }
  }

  const handleShareToWeibo = () => {
    fetchShareInfo().then(() => {
      if (shareInfo?.weiboShareUrl) {
        window.open(shareInfo.weiboShareUrl, '_blank', 'width=600,height=500')
      }
    })
  }

  const handleShareToWechat = () => {
    fetchShareInfo()
    setQrModalOpen(true)
  }

  const handleCopyLink = async () => {
    const url = shareInfo?.url || window.location.href
    try {
      await navigator.clipboard.writeText(url)
      message.success('链接已复制到剪贴板')
    } catch {
      message.info('请手动复制链接: ' + url)
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'wechat',
      icon: <WechatOutlined style={{ color: '#07c160' }} />,
      label: '微信分享',
      onClick: handleShareToWechat,
    },
    {
      key: 'weibo',
      icon: <WeiboOutlined style={{ color: '#e6162d' }} />,
      label: '微博分享',
      onClick: handleShareToWeibo,
    },
    {
      key: 'qrcode',
      icon: <QrcodeOutlined style={{ color: '#c8a96e' }} />,
      label: '二维码',
      onClick: () => {
        fetchShareInfo()
        setQrModalOpen(true)
      },
    },
    {
      key: 'copy',
      icon: <LinkOutlined style={{ color: '#1890ff' }} />,
      label: '复制链接',
      onClick: handleCopyLink,
    },
  ]

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <Button icon={<ShareAltOutlined />} style={{ color: '#c8a96e' }}>
          分享
        </Button>
      </Dropdown>

      <Modal
        title={<span style={{ color: '#c8a96e' }}><WechatOutlined /> 微信扫码分享</span>}
        open={qrModalOpen}
        onCancel={() => setQrModalOpen(false)}
        footer={null}
        centered
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <QRCode
            value={shareInfo?.url || window.location.href}
            size={200}
            style={{ marginBottom: 16 }}
          />
          <Paragraph style={{ color: '#e8e8e8', fontSize: 14, marginBottom: 8 }}>
            {shareInfo?.title || title || '非遗数字保护平台'}
          </Paragraph>
          <Text style={{ color: '#a0a0a0', fontSize: 12 }}>
            打开微信扫一扫，分享给好友
          </Text>
        </div>
      </Modal>
    </>
  )
}

export default SocialShare

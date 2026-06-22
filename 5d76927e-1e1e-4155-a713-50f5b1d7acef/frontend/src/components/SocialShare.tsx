import React, { useState, useEffect, useCallback } from 'react'
import { Button, Dropdown, Modal, QRCode, message, Typography, Tag } from 'antd'
import {
  ShareAltOutlined,
  WechatOutlined,
  WeiboOutlined,
  LinkOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import axios from 'axios'

const { Text, Paragraph } = Typography

declare global {
  interface Window {
    wx: {
      config: (cfg: Record<string, unknown>) => void
      ready: (cb: () => void) => void
      error: (cb: (err: Record<string, unknown>) => void) => void
      checkJsApi: (cfg: { jsApiList: string[]; success: (res: Record<string, unknown>) => void }) => void
      updateAppMessageShareData: (cfg: Record<string, unknown>) => void
      updateTimelineShareData: (cfg: Record<string, unknown>) => void
      onMenuShareAppMessage: (cfg: Record<string, unknown>) => void
      onMenuShareTimeline: (cfg: Record<string, unknown>) => void
      onMenuShareWeibo: (cfg: Record<string, unknown>) => void
      hideAllNonBaseMenuItem: () => void
      showMenuItems: (cfg: { menuList: string[] }) => void
    }
    WB2: {
      any_share: (cfg: Record<string, unknown>) => void
      widget: Record<string, unknown>
    }
  }
}

interface SocialShareProps {
  type: 'heritage' | 'inheritor'
  targetId: string
  title?: string
}

const SOCIAL_SDK_STATE = {
  wechat: 'unloaded' as 'unloaded' | 'loading' | 'ready' | 'failed',
  weibo: 'unloaded' as 'unloaded' | 'loading' | 'ready' | 'failed',
}

const WECHAT_SDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
const WEIBO_SDK_URL = 'https://tjs.sjs.sinajs.cn/open/api/js/wb.js'

const loadScript = (src: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`加载${src}失败`))
    document.head.appendChild(script)
  })
}

const loadWechatSdk = async (): Promise<boolean> => {
  if (SOCIAL_SDK_STATE.wechat === 'ready') return true
  if (SOCIAL_SDK_STATE.wechat === 'failed') return false
  if (SOCIAL_SDK_STATE.wechat === 'loading') {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (SOCIAL_SDK_STATE.wechat === 'ready') {
          clearInterval(check)
          resolve(true)
        } else if (SOCIAL_SDK_STATE.wechat === 'failed') {
          clearInterval(check)
          resolve(false)
        }
      }, 100)
    })
  }
  SOCIAL_SDK_STATE.wechat = 'loading'
  try {
    await loadScript(WECHAT_SDK_URL, 'wechat-jssdk')
    SOCIAL_SDK_STATE.wechat = 'ready'
    return true
  } catch {
    SOCIAL_SDK_STATE.wechat = 'failed'
    return false
  }
}

const loadWeiboSdk = async (): Promise<boolean> => {
  if (SOCIAL_SDK_STATE.weibo === 'ready') return true
  if (SOCIAL_SDK_STATE.weibo === 'failed') return false
  if (SOCIAL_SDK_STATE.weibo === 'loading') {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (SOCIAL_SDK_STATE.weibo === 'ready') {
          clearInterval(check)
          resolve(true)
        } else if (SOCIAL_SDK_STATE.weibo === 'failed') {
          clearInterval(check)
          resolve(false)
        }
      }, 100)
    })
  }
  SOCIAL_SDK_STATE.weibo = 'loading'
  try {
    await loadScript(WEIBO_SDK_URL, 'weibo-jssdk')
    SOCIAL_SDK_STATE.weibo = 'ready'
    return true
  } catch {
    SOCIAL_SDK_STATE.weibo = 'failed'
    return false
  }
}

const SocialShare: React.FC<SocialShareProps> = ({ type, targetId, title }) => {
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [shareResultModalOpen, setShareResultModalOpen] = useState(false)
  const [shareResult, setShareResult] = useState<{
    platform: string
    success: boolean
    message: string
    details: string[]
  } | null>(null)
  const [shareInfo, setShareInfo] = useState<{
    title: string
    description: string
    url: string
    imageUrl: string
    weiboShareUrl?: string
    wechatConfig?: {
      title?: string
      desc?: string
      link?: string
      imgUrl?: string
      jsConfig?: {
        appId: string
        timestamp: number
        nonceStr: string
        signature: string | null
        jsApiList: string[]
        debug: boolean
        jsapiTicketAvailable: boolean
      }
    }
    weiboConfig?: Record<string, unknown>
  } | null>(null)

  const fetchShareInfo = useCallback(async (): Promise<void> => {
    try {
      const res = await axios.get(`/api/share/${type}/${targetId}`)
      const data = res.data?.data || null
      if (data) {
        setShareInfo(data)
      }
    } catch {
      setShareInfo({
        title: title || '非遗数字保护平台',
        description: title || '非遗文化数字化展示',
        url: window.location.href,
        imageUrl: '',
      })
    }
  }, [type, targetId, title])

  useEffect(() => {
    fetchShareInfo()
  }, [fetchShareInfo])

  const setupWechatShare = async (): Promise<{ success: boolean; messages: string[] }> => {
    const messages: string[] = []

    const sdkLoaded = await loadWechatSdk()
    if (!sdkLoaded) {
      messages.push('❌ 微信JSSDK加载失败')
      messages.push('请确保在微信客户端环境中访问，或手动复制链接分享')
      return { success: false, messages }
    }
    messages.push('✅ 微信JSSDK 1.6.0 加载成功')

    const jsConfig = shareInfo?.wechatConfig?.jsConfig
    const shareConfig = shareInfo?.wechatConfig

    if (!jsConfig) {
      messages.push('⚠️  未获取到JSSDK签名配置，尝试使用默认配置')
    } else {
      messages.push(`✅ JSSDK签名配置获取：appId=${jsConfig.appId || '未配置'}`)
      messages.push(`  - timestamp: ${jsConfig.timestamp}`)
      messages.push(`  - nonceStr: ${jsConfig.nonceStr}`)
      messages.push(`  - signature: ${jsConfig.signature ? '已生成' : '未生成（请配置微信AppID/Secret）'}`)
      messages.push(`  - jsapiTicket可用: ${jsConfig.jsapiTicketAvailable ? '是' : '否'}`)
    }

    if (!window.wx) {
      messages.push('❌ window.wx 全局对象不存在')
      return { success: false, messages }
    }

    if (jsConfig && jsConfig.signature) {
      window.wx.config({
        debug: jsConfig.debug,
        appId: jsConfig.appId,
        timestamp: jsConfig.timestamp,
        nonceStr: jsConfig.nonceStr,
        signature: jsConfig.signature,
        jsApiList: jsConfig.jsApiList,
      })
      messages.push('✅ wx.config() 已调用，等待JSSDK鉴权...')

      window.wx.ready(() => {
        messages.push('✅ wx.ready() 触发：JSSDK鉴权通过')
      })

      window.wx.error((err: Record<string, unknown>) => {
        messages.push(`❌ wx.error() 鉴权失败: ${JSON.stringify(err)}`)
      })
    }

    const data = {
      title: shareConfig?.title || shareInfo?.title || title || '非遗数字保护平台',
      desc: shareConfig?.desc || shareInfo?.description || '非遗文化数字化展示',
      link: shareConfig?.link || shareInfo?.url || window.location.href,
      imgUrl: shareConfig?.imgUrl || shareInfo?.imageUrl || '',
      success: () => {
        messages.push('✅ 分享设置成功：用户确认分享时回调')
      },
      cancel: () => {
        messages.push('⚠️  用户取消分享')
      },
    }

    if (window.wx.updateAppMessageShareData) {
      window.wx.updateAppMessageShareData(data)
      messages.push('✅ wx.updateAppMessageShareData()：分享给朋友配置已设置')
    } else if (window.wx.onMenuShareAppMessage) {
      window.wx.onMenuShareAppMessage(data)
      messages.push('✅ wx.onMenuShareAppMessage()：旧版分享给朋友配置已设置')
    } else {
      messages.push('⚠️  未找到分享给朋友的API')
    }

    if (window.wx.updateTimelineShareData) {
      window.wx.updateTimelineShareData(data)
      messages.push('✅ wx.updateTimelineShareData()：分享到朋友圈配置已设置')
    } else if (window.wx.onMenuShareTimeline) {
      window.wx.onMenuShareTimeline(data)
      messages.push('✅ wx.onMenuShareTimeline()：旧版朋友圈配置已设置')
    } else {
      messages.push('⚠️  未找到分享到朋友圈的API')
    }

    if (window.wx.onMenuShareWeibo) {
      window.wx.onMenuShareWeibo(data)
      messages.push('✅ wx.onMenuShareWeibo()：分享到腾讯微博配置已设置')
    }

    if (window.wx.showMenuItems) {
      window.wx.showMenuItems({
        menuList: [
          'menuItem:share:appMessage',
          'menuItem:share:timeline',
          'menuItem:share:weiboApp',
          'menuItem:share:qq',
        ],
      })
      messages.push('✅ wx.showMenuItems()：分享菜单项已显示')
    }

    return { success: true, messages }
  }

  const handleShareToWechat = async () => {
    const info = await setupWechatShare()
    setShareResult({
      platform: '微信分享（JSSDK）',
      success: info.success,
      message: info.success ? '微信JSSDK初始化完成，右上角菜单可分享' : '微信JSSDK未能完全配置',
      details: info.messages,
    })
    setShareResultModalOpen(true)
  }

  const triggerWeiboShare = async (): Promise<{ success: boolean; messages: string[] }> => {
    const messages: string[] = []

    const shareUrl = shareInfo?.weiboShareUrl
    const weiboConfig = shareInfo?.weiboConfig

    messages.push(`📝 分享标题: ${shareInfo?.title || title}`)
    messages.push(`🔗 分享链接: ${shareInfo?.url || window.location.href}`)
    if (shareInfo?.imageUrl) {
      messages.push(`🖼️  分享图片: ${shareInfo.imageUrl}`)
    }
    messages.push(`📄 描述摘要: ${shareInfo?.description?.slice(0, 60)}...`)

    const sdkLoaded = await loadWeiboSdk()
    if (sdkLoaded && window.WB2?.any_share) {
      messages.push('✅ 微博JS-SDK加载成功')
      window.WB2.any_share({
        appkey: weiboConfig?.appkey || '',
        title: shareInfo?.title || title || '非遗数字保护平台',
        ralateUid: '',
        url: shareInfo?.url || window.location.href,
        pic: shareInfo?.imageUrl || '',
        searchPic: 'true',
        style: 'simple',
        width: 400,
        height: 400,
      } as Record<string, unknown>)
      messages.push('✅ 已调用WB2.any_share() 原生微博分享SDK方法')
      return { success: true, messages }
    } else {
      messages.push('⚠️  微博JSSDK不可用，使用跳转方式兜底')
      if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=650,height=500,left=' +
          ((window.innerWidth - 650) / 2) + ',top=' + ((window.innerHeight - 500) / 2))
        messages.push(`✅ 已跳转至微博官方分享页面: ${shareUrl.slice(0, 60)}...`)
        return { success: true, messages }
      }
      messages.push('❌ 无法获取微博分享链接')
      return { success: false, messages }
    }
  }

  const handleShareToWeibo = async () => {
    const info = await triggerWeiboShare()
    setShareResult({
      platform: '微博分享（JS-SDK）',
      success: info.success,
      message: info.success ? '微博分享已触发' : '微博分享未能启动',
      details: info.messages,
    })
    setShareResultModalOpen(true)
  }

  const handleCopyLink = async () => {
    const url = shareInfo?.url || window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareResult({
        platform: '复制链接',
        success: true,
        message: '链接已复制到剪贴板',
        details: [`✅ 已复制链接: ${url}`],
      })
      setShareResultModalOpen(true)
      message.success('链接已复制到剪贴板')
    } catch {
      setShareResult({
        platform: '复制链接',
        success: false,
        message: '请手动复制链接',
        details: [`⚠️  Clipboard API不可用，请手动复制: ${url}`],
      })
      setShareResultModalOpen(true)
      message.info('请手动复制链接: ' + url)
    }
  }

  const handleQrCode = () => {
    fetchShareInfo()
    setQrModalOpen(true)
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'wechat',
      icon: <WechatOutlined style={{ color: '#07c160' }} />,
      label: (
        <span>
          微信分享
          <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>JSSDK</Tag>
        </span>
      ),
      onClick: handleShareToWechat,
    },
    {
      key: 'weibo',
      icon: <WeiboOutlined style={{ color: '#e6162d' }} />,
      label: (
        <span>
          微博分享
          <Tag color="red" style={{ marginLeft: 8, fontSize: 10 }}>SDK</Tag>
        </span>
      ),
      onClick: handleShareToWeibo,
    },
    {
      key: 'qrcode',
      icon: <QrcodeOutlined style={{ color: '#c8a96e' }} />,
      label: '二维码',
      onClick: handleQrCode,
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
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        onOpenChange={open => { if (open) fetchShareInfo() }}
      >
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
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(7,193,96,0.08)', borderRadius: 8 }}>
            <Text style={{ color: '#07c160', fontSize: 12 }}>
              💡 在微信中访问时，可通过右上角菜单使用JSSDK原生分享功能
            </Text>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <span style={{ color: shareResult?.success ? '#52c41a' : '#c8a96e' }}>
            {shareResult?.success ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
            {' '}{shareResult?.platform} - {shareResult?.success ? '执行成功' : '执行提示'}
          </span>
        }
        open={shareResultModalOpen}
        onCancel={() => setShareResultModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShareResultModalOpen(false)}>
            我知道了
          </Button>,
        ]}
        width={600}
      >
        <Paragraph style={{ color: '#e8e8e8', marginBottom: 16, fontSize: 14 }}>
          {shareResult?.message}
        </Paragraph>
        <div
          style={{
            background: '#0f1626',
            borderRadius: 8,
            padding: 16,
            maxHeight: 280,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          {shareResult?.details.map((d, i) => (
            <div key={i} style={{ lineHeight: 2, color: '#c8c8c8', wordBreak: 'break-all' }}>
              {d}
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}

export default SocialShare

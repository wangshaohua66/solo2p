import { Message, PageResult } from '@/types'

const mockMessages: Message[] = [
  {
    id: 'msg1',
    userId: 'user1',
    type: 'application',
    title: '简历投递成功',
    content: '您已成功向华为技术有限公司的「前端开发工程师」岗位投递简历，企业将在3个工作日内给予回复。',
    isRead: false,
    relatedId: 'app1',
    createdAt: '2024-03-10 08:45:00'
  },
  {
    id: 'msg2',
    userId: 'user1',
    type: 'interview',
    title: '面试邀请通知',
    content: '恭喜您！腾讯科技有限公司邀请您参加「产品经理」岗位的视频面试，请在个人中心查看详情并确认。',
    isRead: false,
    relatedId: 'int2',
    createdAt: '2024-03-08 10:30:00'
  },
  {
    id: 'msg3',
    userId: 'user1',
    type: 'system',
    title: '系统通知',
    content: '您的企业认证已通过审核，现在可以发布岗位和参加招聘会了！',
    isRead: true,
    createdAt: '2024-03-05 14:20:00'
  },
  {
    id: 'msg4',
    userId: 'user1',
    type: 'notification',
    title: '招聘会提醒',
    content: '您报名参加的「春季大型人才招聘会」将于明天上午9点开始，请准时参加。',
    isRead: true,
    relatedId: 'rec1',
    createdAt: '2024-03-04 09:00:00'
  },
  {
    id: 'msg5',
    userId: 'user1',
    type: 'application',
    title: '简历已被查看',
    content: '阿里巴巴的HR查看了您的简历，请保持电话畅通，随时可能收到面试邀请。',
    isRead: true,
    relatedId: 'app2',
    createdAt: '2024-03-03 16:45:00'
  }
]

export const mockGetMessageList = (params: {
  page?: number
  pageSize?: number
  type?: string
  isRead?: boolean
}): Promise<PageResult<Message>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { page = 1, pageSize = 10, type, isRead } = params
      
      let filtered = [...mockMessages]
      
      if (type && type !== 'all') {
        filtered = filtered.filter(item => item.type === type)
      }
      
      if (typeof isRead === 'boolean') {
        filtered = filtered.filter(item => item.isRead === isRead)
      }
      
      const start = (page - 1) * pageSize
      const end = start + pageSize
      
      resolve({
        list: filtered.slice(start, end),
        total: filtered.length,
        page,
        pageSize
      })
    }, 200)
  })
}

export const mockGetUnreadCount = (): Promise<number> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const count = mockMessages.filter(m => !m.isRead).length
      resolve(count)
    }, 200)
  })
}

export const mockMarkAsRead = (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const msg = mockMessages.find(m => m.id === id)
      if (msg) msg.isRead = true
      resolve()
    }, 100)
  })
}

export const mockMarkAllAsRead = (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      mockMessages.forEach(m => { m.isRead = true })
      resolve()
    }, 200)
  })
}

const notificationSettings = {
  application: { email: true, sms: true, inapp: true },
  interview: { email: true, sms: true, inapp: true },
  system: { email: false, sms: false, inapp: true },
  marketing: { email: false, sms: false, inapp: false }
}

export const mockGetNotificationSettings = () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(notificationSettings), 200)
  })
}

export const mockUpdateNotificationSettings = (settings: any) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      Object.assign(notificationSettings, settings)
      resolve(true)
    }, 300)
  })
}

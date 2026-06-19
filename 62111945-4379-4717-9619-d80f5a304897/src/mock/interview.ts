import { Interview, PageResult } from '@/types'
import dayjs from 'dayjs'

const mockInterviews: Interview[] = [
  {
    id: 'int1',
    applicationId: 'app1',
    jobId: 'job1',
    jobTitle: '前端开发工程师',
    enterpriseId: 'ent1',
    enterpriseName: '华为技术有限公司',
    jobseekerId: 'js001',
    jobseekerName: '王小明',
    type: 'video',
    status: 'confirmed',
    scheduledTime: dayjs().add(1, 'day').hour(14).minute(0).format('YYYY-MM-DD HH:mm:ss'),
    duration: 60,
    roomId: 'room-12345',
    createdAt: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'int2',
    applicationId: 'app3',
    jobId: 'job3',
    jobTitle: '产品经理',
    enterpriseId: 'ent3',
    enterpriseName: '腾讯科技有限公司',
    jobseekerId: 'js001',
    jobseekerName: '王小明',
    type: 'video',
    status: 'completed',
    scheduledTime: dayjs().subtract(3, 'day').hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'),
    duration: 45,
    roomId: 'room-67890',
    evaluation: '候选人表达能力强，产品思维清晰，对行业有深入理解，建议录用。',
    rating: 4,
    createdAt: dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'int3',
    applicationId: 'app2',
    jobId: 'job2',
    jobTitle: 'Java开发工程师',
    enterpriseId: 'ent2',
    enterpriseName: '阿里巴巴集团',
    jobseekerId: 'js002',
    jobseekerName: '李华',
    type: 'video',
    status: 'pending',
    scheduledTime: dayjs().add(2, 'day').hour(15).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    duration: 50,
    createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  }
]

export const mockGetInterviewList = (params: {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  role?: 'enterprise' | 'jobseeker'
}): Promise<PageResult<Interview>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { page = 1, pageSize = 10, status, type, role } = params
      
      let filtered = [...mockInterviews]
      
      if (status && status !== 'all') {
        filtered = filtered.filter(item => item.status === status)
      }
      
      if (type && type !== 'all') {
        filtered = filtered.filter(item => item.type === type)
      }
      
      const start = (page - 1) * pageSize
      const end = start + pageSize
      
      resolve({
        list: filtered.slice(start, end),
        total: filtered.length,
        page,
        pageSize
      })
    }, 300)
  })
}

export const mockGetInterviewDetail = (id: string): Promise<Interview | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const interview = mockInterviews.find(i => i.id === id)
      resolve(interview || null)
    }, 200)
  })
}

export const mockCreateInterview = (data: Partial<Interview>): Promise<Interview> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newInterview: Interview = {
        id: `int${Date.now()}`,
        applicationId: data.applicationId || '',
        jobId: data.jobId || '',
        jobTitle: data.jobTitle || '',
        enterpriseId: data.enterpriseId || '',
        enterpriseName: data.enterpriseName || '',
        jobseekerId: data.jobseekerId || '',
        jobseekerName: data.jobseekerName || '',
        type: data.type || 'video',
        status: 'pending',
        scheduledTime: data.scheduledTime || '',
        duration: data.duration || 60,
        createdAt: new Date().toISOString()
      }
      mockInterviews.unshift(newInterview)
      resolve(newInterview)
    }, 500)
  })
}

export const mockSubmitInterviewEvaluation = (
  id: string,
  data: { evaluation: string; rating: number }
): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const interview = mockInterviews.find(i => i.id === id)
      if (interview) {
        interview.evaluation = data.evaluation
        interview.rating = data.rating
        interview.status = 'completed'
      }
      resolve()
    }, 300)
  })
}

export const mockJoinInterview = (roomId: string): Promise<{ token: string; wsUrl: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        token: `rtc-token-${roomId}-${Date.now()}`,
        wsUrl: `wss://rtc.example.com/${roomId}`
      })
    }, 200)
  })
}

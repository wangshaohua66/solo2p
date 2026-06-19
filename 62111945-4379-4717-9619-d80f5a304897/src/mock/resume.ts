import { Resume, ApplicationRecord, PageResult } from '@/types'

const skillsPool = ['JavaScript', 'TypeScript', 'React', 'Vue', 'Node.js', 'Python', 'Java', 'MySQL', 'Redis', 'Docker', 'Git', 'Linux']

const generateResume = (id: string, isDefault: boolean = false): Resume => {
  const workCount = 2 + Math.floor(Math.random() * 3)
  const workExperience = []
  for (let i = 0; i < workCount; i++) {
    workExperience.push({
      id: `work${i}`,
      company: ['腾讯', '阿里', '百度', '字节', '美团'][i % 5],
      position: ['前端开发工程师', '高级前端工程师', '前端架构师'][Math.min(i, 2)],
      startTime: `201${8 + i}-03`,
      endTime: i === 0 ? '至今' : `201${9 + i}-02`,
      description: '负责公司核心业务的前端开发工作，参与技术选型和架构设计，带领团队完成多个重要项目。'
    })
  }
  
  const skillCount = 5 + Math.floor(Math.random() * 5)
  const skills: string[] = []
  for (let i = 0; i < skillCount; i++) {
    const skill = skillsPool[Math.floor(Math.random() * skillsPool.length)]
    if (!skills.includes(skill)) skills.push(skill)
  }
  
  return {
    id,
    jobseekerId: 'js001',
    title: isDefault ? '默认简历' : `简历版本${id.slice(-1)}`,
    isDefault,
    isPublic: true,
    name: '王小明',
    gender: 'male',
    age: 28,
    phone: '138****8888',
    email: 'wangxiaoming@email.com',
    education: '本科',
    experience: 5,
    skills,
    expectedPosition: '高级前端开发工程师',
    expectedSalaryMin: 20000,
    expectedSalaryMax: 35000,
    workExperience,
    educationExperience: [
      {
        id: 'edu1',
        school: '北京大学',
        major: '计算机科学与技术',
        degree: '本科',
        startTime: '2012-09',
        endTime: '2016-06'
      }
    ],
    projectExperience: [
      {
        id: 'proj1',
        name: '电商平台重构',
        role: '前端负责人',
        startTime: '2021-03',
        endTime: '2022-09',
        description: '主导电商平台前端架构重构，采用微前端方案，提升页面性能30%，降低维护成本。'
      }
    ],
    createdAt: '2023-01-15 10:30:00',
    updatedAt: '2024-03-10 14:20:00'
  }
}

const mockResumes: Resume[] = [
  generateResume('res1', true),
  generateResume('res2'),
  generateResume('res3')
]

export const mockGetResumeList = (): Promise<Resume[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockResumes)
    }, 300)
  })
}

export const mockGetResumeDetail = (id: string): Promise<Resume | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const resume = mockResumes.find(r => r.id === id)
      resolve(resume || null)
    }, 200)
  })
}

export const mockSaveResume = (data: Partial<Resume>): Promise<Resume> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const resume = mockResumes.find(r => r.id === data.id)
      if (resume) {
        Object.assign(resume, data)
        resolve(resume)
      } else {
        const newResume = generateResume(`res${Date.now()}`)
        mockResumes.push(newResume)
        resolve(newResume)
      }
    }, 500)
  })
}

export const mockDeleteResume = (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const idx = mockResumes.findIndex(r => r.id === id)
      if (idx > -1) mockResumes.splice(idx, 1)
      resolve()
    }, 300)
  })
}

export const mockSetDefaultResume = (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      mockResumes.forEach(r => { r.isDefault = r.id === id })
      resolve()
    }, 200)
  })
}

const statusList: ApplicationRecord['status'][] = ['applied', 'viewed', 'interview', 'offer', 'rejected']

const applicationMock: ApplicationRecord[] = [
  {
    id: 'app1',
    jobId: 'job1',
    jobTitle: '前端开发工程师',
    enterpriseId: 'ent1',
    enterpriseName: '华为技术有限公司',
    resumeId: 'res1',
    resumeTitle: '默认简历',
    status: 'interview',
    matchScore: 92,
    appliedAt: '2024-03-01 10:30:00',
    updatedAt: '2024-03-05 14:20:00'
  },
  {
    id: 'app2',
    jobId: 'job2',
    jobTitle: 'Java开发工程师',
    enterpriseId: 'ent2',
    enterpriseName: '阿里巴巴集团',
    resumeId: 'res1',
    resumeTitle: '默认简历',
    status: 'viewed',
    matchScore: 85,
    appliedAt: '2024-03-02 09:15:00',
    updatedAt: '2024-03-03 16:45:00'
  },
  {
    id: 'app3',
    jobId: 'job3',
    jobTitle: '产品经理',
    enterpriseId: 'ent3',
    enterpriseName: '腾讯科技有限公司',
    resumeId: 'res2',
    resumeTitle: '简历版本2',
    status: 'offer',
    matchScore: 78,
    appliedAt: '2024-02-25 11:00:00',
    updatedAt: '2024-03-08 10:00:00'
  },
  {
    id: 'app4',
    jobId: 'job4',
    jobTitle: 'UI设计师',
    enterpriseId: 'ent4',
    enterpriseName: '字节跳动科技',
    resumeId: 'res1',
    resumeTitle: '默认简历',
    status: 'rejected',
    matchScore: 65,
    appliedAt: '2024-02-20 14:30:00',
    updatedAt: '2024-02-22 09:00:00'
  },
  {
    id: 'app5',
    jobId: 'job5',
    jobTitle: '测试工程师',
    enterpriseId: 'ent5',
    enterpriseName: '美团点评',
    resumeId: 'res1',
    resumeTitle: '默认简历',
    status: 'applied',
    matchScore: 88,
    appliedAt: '2024-03-10 08:45:00',
    updatedAt: '2024-03-10 08:45:00'
  }
]

export const mockGetApplicationList = (params: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<PageResult<ApplicationRecord>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { page = 1, pageSize = 10, status } = params
      
      let filtered = [...applicationMock]
      if (status && status !== 'all') {
        filtered = filtered.filter(item => item.status === status)
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

export const mockApplyJob = (jobId: string, resumeId: string): Promise<ApplicationRecord> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newApp: ApplicationRecord = {
        id: `app${Date.now()}`,
        jobId,
        jobTitle: '测试岗位',
        enterpriseId: 'ent1',
        enterpriseName: '测试企业',
        resumeId,
        resumeTitle: '默认简历',
        status: 'applied',
        matchScore: Math.floor(70 + Math.random() * 25),
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      applicationMock.unshift(newApp)
      resolve(newApp)
    }, 500)
  })
}

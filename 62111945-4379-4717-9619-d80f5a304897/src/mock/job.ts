import { Job, PageResult } from '@/types'

const industries = ['互联网', '金融', '制造业', '教育', '医疗健康', '房地产', '零售', '物流']
const experiences = ['不限', '应届', '1-3年', '3-5年', '5-10年', '10年以上']
const educations = ['不限', '大专', '本科', '硕士', '博士']
const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安']

const jobTitles = [
  '前端开发工程师', '后端开发工程师', '产品经理', 'UI设计师', '测试工程师',
  '运维工程师', '数据分析师', 'Java开发工程师', 'Python开发工程师', '算法工程师',
  '项目经理', '销售经理', '人力资源专员', '财务会计', '市场专员',
  '客服专员', '行政助理', '文案策划', '运营专员', '商务经理'
]

const enterprises = [
  '华为技术有限公司', '阿里巴巴集团', '腾讯科技有限公司', '字节跳动科技',
  '美团点评', '京东集团', '小米科技', '百度在线',
  '网易公司', '滴滴出行', '快手科技', '哔哩哔哩'
]

const tagPool = ['五险一金', '年终奖', '带薪年假', '弹性工作', '远程办公', '股票期权', '定期体检', '节日福利', '免费午餐', '健身房']

const generateJobs = (count: number): Job[] => {
  const list: Job[] = []
  for (let i = 0; i < count; i++) {
    const salaryMin = 8 + Math.floor(Math.random() * 30)
    const salaryMax = salaryMin + 5 + Math.floor(Math.random() * 20)
    const tagCount = 3 + Math.floor(Math.random() * 4)
    const tags: string[] = []
    for (let j = 0; j < tagCount; j++) {
      const tag = tagPool[Math.floor(Math.random() * tagPool.length)]
      if (!tags.includes(tag)) tags.push(tag)
    }
    
    const statuses: Job['status'][] = ['online', 'online', 'online', 'pending', 'offline']
    
    list.push({
      id: `job${i + 1}`,
      enterpriseId: `ent${(i % 12) + 1}`,
      enterpriseName: enterprises[i % enterprises.length],
      title: jobTitles[i % jobTitles.length],
      salaryMin: salaryMin * 1000,
      salaryMax: salaryMax * 1000,
      location: cities[i % cities.length],
      experience: experiences[i % experiences.length],
      education: educations[i % educations.length],
      tags,
      description: `岗位职责：\n1、负责公司产品的开发与维护工作；\n2、参与需求分析和技术方案设计；\n3、编写技术文档和单元测试；\n4、与产品、测试团队紧密配合，确保项目高质量交付。`,
      requirements: `任职要求：\n1、本科及以上学历，计算机相关专业优先；\n2、3年以上相关工作经验；\n3、熟悉相关技术栈，有大型项目经验者优先；\n4、良好的沟通能力和团队协作精神。`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      applyCount: Math.floor(Math.random() * 200),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  }
  return list
}

const mockJobs = generateJobs(50)

export const mockGetJobList = (params: {
  page?: number
  pageSize?: number
  keyword?: string
  city?: string
  experience?: string
  education?: string
  salaryMin?: number
  salaryMax?: number
  enterpriseId?: string
  status?: string
}): Promise<PageResult<Job>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { 
        page = 1, pageSize = 10, keyword, city, experience, 
        education, salaryMin, salaryMax, enterpriseId, status 
      } = params
      
      let filtered = [...mockJobs]
      
      if (keyword) {
        filtered = filtered.filter(item => 
          item.title.includes(keyword) || 
          item.enterpriseName.includes(keyword) ||
          item.tags.some(tag => tag.includes(keyword))
        )
      }
      
      if (city && city !== 'all') {
        filtered = filtered.filter(item => item.location === city)
      }
      
      if (experience && experience !== 'all') {
        filtered = filtered.filter(item => item.experience === experience)
      }
      
      if (education && education !== 'all') {
        filtered = filtered.filter(item => item.education === education)
      }
      
      if (salaryMin) {
        filtered = filtered.filter(item => item.salaryMax >= salaryMin)
      }
      
      if (salaryMax) {
        filtered = filtered.filter(item => item.salaryMin <= salaryMax)
      }
      
      if (enterpriseId) {
        filtered = filtered.filter(item => item.enterpriseId === enterpriseId)
      }
      
      if (status && status !== 'all') {
        filtered = filtered.filter(item => item.status === status)
      }
      
      const start = (page - 1) * pageSize
      const end = start + pageSize
      const list = filtered.slice(start, end)
      
      resolve({
        list,
        total: filtered.length,
        page,
        pageSize
      })
    }, 200)
  })
}

export const mockGetJobDetail = (id: string): Promise<Job | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const job = mockJobs.find(j => j.id === id)
      resolve(job || null)
    }, 200)
  })
}

export const mockRecommendJobs = (count = 6): Promise<Job[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const shuffled = [...mockJobs].sort(() => 0.5 - Math.random())
      resolve(shuffled.slice(0, count))
    }, 300)
  })
}

export const mockPublishJob = (data: Partial<Job>): Promise<Job> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newJob: Job = {
        id: `job${Date.now()}`,
        enterpriseId: data.enterpriseId || 'ent001',
        enterpriseName: data.enterpriseName || '测试企业',
        title: data.title || '',
        salaryMin: data.salaryMin || 8000,
        salaryMax: data.salaryMax || 15000,
        location: data.location || '北京',
        experience: data.experience || '不限',
        education: data.education || '不限',
        tags: data.tags || [],
        description: data.description || '',
        requirements: data.requirements || '',
        status: 'pending',
        applyCount: 0,
        createdAt: new Date().toISOString()
      }
      mockJobs.unshift(newJob)
      resolve(newJob)
    }, 500)
  })
}

export const mockBatchImportJobs = (jobs: Partial<Job>[]): Promise<{ success: number; failed: number }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const success = Math.floor(jobs.length * 0.9)
      resolve({ success, failed: jobs.length - success })
    }, 1000)
  })
}

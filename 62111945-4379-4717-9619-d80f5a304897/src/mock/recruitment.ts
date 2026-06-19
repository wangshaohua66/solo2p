import { Recruitment, Booth, PageResult } from '@/types'
import dayjs from 'dayjs'

const centers = [
  { id: 'center1', name: '东城区人才服务中心' },
  { id: 'center2', name: '西城区人才服务中心' },
  { id: 'center3', name: '朝阳区人才服务中心' },
  { id: 'center4', name: '海淀区人才服务中心' },
  { id: 'center5', name: '丰台区人才服务中心' },
  { id: 'center6', name: '石景山区人才服务中心' },
  { id: 'center7', name: '通州区人才服务中心' },
  { id: 'center8', name: '顺义区人才服务中心' }
]

const recruitmentTitles = [
  '春季大型人才招聘会',
  '高校毕业生专场招聘会',
  '互联网行业专场招聘会',
  '制造业人才招聘会',
  '服务业专场招聘会',
  '高层次人才洽谈会',
  '应届生就业双选会',
  '中高级人才招聘会',
  '民营企业招聘周',
  '金秋招聘月专场'
]

const locations = [
  '人才大厦一层展厅',
  '人力资源产业园A座',
  '会展中心2号馆',
  '科技园区创业大厦',
  '文化中心多功能厅'
]

const generateRecruitments = (count: number): Recruitment[] => {
  const list: Recruitment[] = []
  for (let i = 0; i < count; i++) {
    const center = centers[i % centers.length]
    const startDate = dayjs().add(i - 2, 'day').hour(9).minute(0)
    const endDate = startDate.add(6, 'hour')
    
    let status: Recruitment['status'] = 'pending'
    if (dayjs().isAfter(startDate) && dayjs().isBefore(endDate)) {
      status = 'ongoing'
    } else if (dayjs().isAfter(endDate)) {
      status = 'ended'
    }
    
    list.push({
      id: `rec${i + 1}`,
      title: `${center.name.split('区')[0]}区·${recruitmentTitles[i % recruitmentTitles.length]}`,
      description: `本次招聘会由${center.name}主办，汇聚百余家优质企业，提供上千个就业岗位。涵盖互联网、金融、制造、服务等多个行业，欢迎广大求职者踊跃参与。`,
      startTime: startDate.format('YYYY-MM-DD HH:mm:ss'),
      endTime: endDate.format('YYYY-MM-DD HH:mm:ss'),
      location: locations[i % locations.length],
      centerId: center.id,
      centerName: center.name,
      status,
      enterpriseCount: 50 + Math.floor(Math.random() * 100),
      jobCount: 200 + Math.floor(Math.random() * 500),
      attendeeCount: 500 + Math.floor(Math.random() * 2000),
      boothCount: 80 + Math.floor(Math.random() * 50),
      signInCount: Math.floor(Math.random() * 500),
      intentionCount: Math.floor(Math.random() * 300),
      createdAt: startDate.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss')
    })
  }
  return list
}

const mockRecruitments = generateRecruitments(20)

export const mockGetRecruitmentList = (params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  centerId?: string
}): Promise<PageResult<Recruitment>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { page = 1, pageSize = 10, keyword, status, centerId } = params
      
      let filtered = [...mockRecruitments]
      
      if (keyword) {
        filtered = filtered.filter(item => 
          item.title.includes(keyword) || item.description.includes(keyword)
        )
      }
      
      if (status && status !== 'all') {
        filtered = filtered.filter(item => item.status === status)
      }
      
      if (centerId) {
        filtered = filtered.filter(item => item.centerId === centerId)
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
    }, 500)
  })
}

export const mockGetRecruitmentDetail = (id: string): Promise<Recruitment | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const item = mockRecruitments.find(r => r.id === id)
      resolve(item || null)
    }, 300)
  })
}

export const mockGetBoothList = (recruitmentId: string): Promise<Booth[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const booths: Booth[] = []
      const letters = ['A', 'B', 'C', 'D']
      const enterprises = ['华为技术', '阿里巴巴', '腾讯科技', '字节跳动', '美团', '京东', '小米科技', '百度']
      
      for (let i = 0; i < 4; i++) {
        for (let j = 1; j <= 10; j++) {
          const boothNum = `${letters[i]}${j.toString().padStart(2, '0')}`
          const hasEnterprise = Math.random() > 0.3
          const randomIdx = Math.floor(Math.random() * enterprises.length)
          
          booths.push({
            id: `booth-${boothNum}`,
            recruitmentId,
            boothNumber: boothNum,
            enterpriseId: hasEnterprise ? `ent-${randomIdx}` : undefined,
            enterpriseName: hasEnterprise ? enterprises[randomIdx] : undefined,
            status: hasEnterprise ? (Math.random() > 0.5 ? 'assigned' : 'checked_in') : 'available',
            area: `${letters[i]}区`
          })
        }
      }
      
      resolve(booths)
    }, 400)
  })
}

export const mockCreateRecruitment = (data: Partial<Recruitment>): Promise<Recruitment> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newRec: Recruitment = {
        id: `rec${Date.now()}`,
        title: data.title || '',
        description: data.description || '',
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        location: data.location || '',
        centerId: data.centerId || 'center1',
        centerName: centers.find(c => c.id === data.centerId)?.name || '',
        status: 'pending',
        enterpriseCount: 0,
        jobCount: 0,
        attendeeCount: 0,
        boothCount: data.boothCount || 50,
        signInCount: 0,
        intentionCount: 0,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      }
      mockRecruitments.unshift(newRec)
      resolve(newRec)
    }, 500)
  })
}

export const mockGetCenters = () => centers

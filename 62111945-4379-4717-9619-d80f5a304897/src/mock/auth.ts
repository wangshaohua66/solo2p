import { UserRole } from '@/types'

const TOKEN = 'mock-jwt-token-12345'

const adminUser = {
  id: 'admin001',
  username: 'admin',
  name: '张管理员',
  role: UserRole.ADMIN,
  avatar: '',
  phone: '13800138000',
  email: 'admin@talent.gov.cn',
  centerId: 'center0'
}

const enterpriseUser = {
  id: 'ent001',
  username: 'enterprise',
  name: '李HR',
  role: UserRole.ENTERPRISE,
  avatar: '',
  phone: '13900139000',
  email: 'hr@company.com',
  companyId: 'comp001'
}

const jobseekerUser = {
  id: 'js001',
  username: 'jobseeker',
  name: '王小明',
  role: UserRole.JOBSEEKER,
  avatar: '',
  phone: '13700137000',
  email: 'wangxiaoming@email.com'
}

export const mockLogin = (username: string, password: string, role: UserRole) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let userInfo
      switch (role) {
        case UserRole.ADMIN:
          userInfo = adminUser
          break
        case UserRole.ENTERPRISE:
          userInfo = enterpriseUser
          break
        case UserRole.JOBSEEKER:
          userInfo = jobseekerUser
          break
        default:
          reject(new Error('角色不存在'))
          return
      }
      
      resolve({
        token: TOKEN,
        userInfo: { ...userInfo, username }
      })
    }, 600)
  })
}

export const mockGetUserInfo = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(adminUser)
    }, 300)
  })
}

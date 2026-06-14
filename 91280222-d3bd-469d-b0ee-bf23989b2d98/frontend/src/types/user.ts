export enum UserRole {
  PROJECT_MANAGER = 'project_manager',
  DESIGNER = 'designer',
  REVIEWER = 'reviewer'
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: UserRole
  department?: string
}

export interface JwtPayload {
  userId: string
  name: string
  role: UserRole
  exp: number
}

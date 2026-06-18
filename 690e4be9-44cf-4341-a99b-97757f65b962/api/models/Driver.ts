export interface Driver {
  id: string
  name: string
  employeeId: string
  licenseType: string
  status: string
  lineId: string | undefined
  dailyWorkMinutes: number
  phone: string | undefined
}

import http from './http'
import type {
  Course,
  CourseRegistration,
  AttendanceRecord,
  PagedResult,
  PagedQuery
} from '@/types'

export const courseApi = {
  getCourses(params?: {
    type?: string
    level?: string
    status?: string
    instructorId?: string
  } & PagedQuery): Promise<PagedResult<Course>> {
    return http.get('/courses', { params })
  },

  getCourse(id: string): Promise<Course> {
    return http.get(`/courses/${id}`)
  },

  createCourse(data: Partial<Course>): Promise<Course> {
    return http.post('/courses', data)
  },

  updateCourse(id: string, data: Partial<Course>): Promise<Course> {
    return http.put(`/courses/${id}`, data)
  },

  deleteCourse(id: string): Promise<void> {
    return http.delete(`/courses/${id}`)
  },

  publishCourse(id: string): Promise<Course> {
    return http.post(`/courses/${id}/publish`)
  },

  cancelCourse(id: string): Promise<Course> {
    return http.post(`/courses/${id}/cancel`)
  },

  getRegistrations(courseId: string): Promise<CourseRegistration[]> {
    return http.get(`/courses/${courseId}/registrations`)
  },

  register(courseId: string): Promise<CourseRegistration> {
    return http.post(`/courses/${courseId}/register`)
  },

  cancelRegistration(courseId: string): Promise<void> {
    return http.delete(`/courses/${courseId}/register`)
  },

  checkIn(courseId: string, sessionId: string, qrCode?: string): Promise<AttendanceRecord> {
    return http.post(`/courses/${courseId}/sessions/${sessionId}/check-in`, { qrCode })
  },

  generateQrCode(courseId: string, sessionId: string): Promise<{ qrDataUrl: string }> {
    return http.get(`/courses/${courseId}/sessions/${sessionId}/qr-code`)
  },

  getAttendance(courseId: string, sessionId: string): Promise<AttendanceRecord[]> {
    return http.get(`/courses/${courseId}/sessions/${sessionId}/attendance`)
  },

  getMyCourses(status?: string): Promise<CourseRegistration[]> {
    return http.get('/courses/my', { params: { status } })
  },

  getMyRegistration(courseId: string): Promise<CourseRegistration> {
    return http.get(`/courses/${courseId}/my-registration`)
  },

  getWaitlist(courseId: string): Promise<CourseRegistration[]> {
    return http.get(`/courses/${courseId}/waitlist`)
  },

  markAttendance(courseId: string, sessionId: string, memberId: string, status: string): Promise<AttendanceRecord> {
    return http.put(`/courses/${courseId}/sessions/${sessionId}/attendance`, {
      memberId,
      status
    })
  }
}

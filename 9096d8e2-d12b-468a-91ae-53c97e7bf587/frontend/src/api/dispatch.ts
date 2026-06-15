import { get, post, patch } from './request'
import type {
  EmergencyCallRequest,
  DispatchCommandRequest,
  EventStatusUpdateRequest,
  VehicleRecommendation,
  DispatchEventSummary,
  DispatchEventDetail,
  VehicleStatusUpdate,
  LocationDto,
  NearbyVehicleRequest,
  PageResponse
} from '@/types/dispatch'

export function createEmergencyCall(request: EmergencyCallRequest): Promise<DispatchEventDetail> {
  return post<DispatchEventDetail>('/dispatch/emergency-call', request)
}

export function findNearbyVehicles(request: NearbyVehicleRequest): Promise<VehicleRecommendation[]> {
  return get<VehicleRecommendation[]>('/dispatch/nearby-vehicles', {
    params: {
      longitude: request.longitude,
      latitude: request.latitude,
      radiusKm: request.radiusKm,
      statuses: request.statuses.join(',')
    }
  })
}

export function dispatchVehicle(request: DispatchCommandRequest): Promise<DispatchEventDetail> {
  return post<DispatchEventDetail>('/dispatch/dispatch', request)
}

export function updateEventStatus(
  eventId: number,
  request: EventStatusUpdateRequest
): Promise<DispatchEventDetail> {
  return patch<DispatchEventDetail>(`/dispatch/events/${eventId}/status`, request)
}

export function getActiveEvents(page = 0, size = 20): Promise<PageResponse<DispatchEventSummary>> {
  return get<PageResponse<DispatchEventSummary>>('/dispatch/events/active', {
    params: { page, size }
  })
}

export function getEventDetail(eventId: number): Promise<DispatchEventDetail> {
  return get<DispatchEventDetail>(`/dispatch/events/${eventId}`)
}

export function getEventsByDateRange(
  startDate: string,
  endDate: string,
  page = 0,
  size = 20
): Promise<PageResponse<DispatchEventSummary>> {
  return get<PageResponse<DispatchEventSummary>>('/dispatch/events', {
    params: { startDate, endDate, page, size }
  })
}

export function getDashboard(): Promise<Map<string, any>> {
  return get<Map<string, any>>('/dispatch/dashboard')
}

export function getVehicleTrack(
  ambulanceId: number,
  startTime: string,
  endTime: string
): Promise<LocationDto[]> {
  return get<LocationDto[]>(`/dispatch/vehicles/${ambulanceId}/track`, {
    params: { startTime, endTime }
  })
}

export function getAllVehiclesLocation(): Promise<Map<number, VehicleStatusUpdate>> {
  return get<Map<number, VehicleStatusUpdate>>('/dispatch/vehicles/locations')
}

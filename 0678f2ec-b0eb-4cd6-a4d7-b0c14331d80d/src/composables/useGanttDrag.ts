import { ref, computed } from 'vue';
import { useApronStore } from '@/stores/apron';
import type { Flight, ServiceTask } from '@/types/apron';
import { MIN_TURNAROUND_INTERVAL } from '@/utils/constants';

interface DragState {
  isDragging: boolean;
  flightId: string | null;
  serviceId: string | null;
  startX: number;
  startTime: number;
  originalStart: number;
  originalEnd: number;
}

export function useGanttDrag() {
  const store = useApronStore();
  const dragState = ref<DragState>({
    isDragging: false,
    flightId: null,
    serviceId: null,
    startX: 0,
    startTime: 0,
    originalStart: 0,
    originalEnd: 0,
  });

  const conflicts = ref<
    { flightId: string; serviceId?: string; type: string }[]
  >([]);

  const timeScale = computed(() => {
    const now = store.currentTime;
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    return {
      start: startOfDay,
      end: endOfDay,
      total: endOfDay - startOfDay,
    };
  });

  const timeToX = (time: number, containerWidth: number): number => {
    const { start, total } = timeScale.value;
    return ((time - start) / total) * containerWidth;
  };

  const xToTime = (x: number, containerWidth: number): number => {
    const { start, total } = timeScale.value;
    return start + (x / containerWidth) * total;
  };

  const checkConflicts = (
    flightId: string,
    newStartTime: number,
    newEndTime: number,
    serviceId?: string
  ) => {
    const detectedConflicts: typeof conflicts.value = [];
    const flight = store.flightById(flightId);
    if (!flight) return detectedConflicts;

    const standFlights = store.flights
      .filter((f) => f.standId === flight.standId && f.id !== flightId)
      .sort((a, b) => a.arrivalTime - b.arrivalTime);

    for (const otherFlight of standFlights) {
      if (
        (newStartTime >= otherFlight.arrivalTime &&
          newStartTime < otherFlight.departureTime) ||
        (newEndTime > otherFlight.arrivalTime &&
          newEndTime <= otherFlight.departureTime) ||
        (newStartTime <= otherFlight.arrivalTime &&
          newEndTime >= otherFlight.departureTime)
      ) {
        detectedConflicts.push({
          flightId: otherFlight.id,
          type: 'stand-overlap',
        });
      }
    }

    if (serviceId) {
      const service = flight.services.find((s) => s.id === serviceId);
      if (service) {
        const otherServices = flight.services.filter((s) => s.id !== serviceId);
        for (const other of otherServices) {
          if (
            (newStartTime >= other.startTime && newStartTime < other.endTime) ||
            (newEndTime > other.startTime && newEndTime <= other.endTime)
          ) {
            detectedConflicts.push({
              flightId,
              serviceId: other.id,
              type: 'service-overlap',
            });
          }
        }
      }
    }

    return detectedConflicts;
  };

  const startDrag = (
    e: MouseEvent,
    flightId: string,
    containerWidth: number,
    serviceId?: string
  ) => {
    e.preventDefault();
    const flight = store.flightById(flightId);
    if (!flight) return;

    let startTime: number;
    let endTime: number;

    if (serviceId) {
      const service = flight.services.find((s) => s.id === serviceId);
      if (!service) return;
      startTime = service.startTime;
      endTime = service.endTime;
    } else {
      startTime = flight.arrivalTime;
      endTime = flight.departureTime;
    }

    dragState.value = {
      isDragging: true,
      flightId,
      serviceId: serviceId || null,
      startX: e.clientX,
      startTime: xToTime(e.clientX - timeToX(startTime, containerWidth), containerWidth),
      originalStart: startTime,
      originalEnd: endTime,
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', endDrag);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!dragState.value.isDragging || !dragState.value.flightId) return;

    const dx = e.clientX - dragState.value.startX;
    const containerWidth = 800;
    const timeDelta = xToTime(dx, containerWidth) - timeToTime(0, containerWidth);

    const duration =
      dragState.value.originalEnd - dragState.value.originalStart;
    const newStart = dragState.value.originalStart + timeDelta;
    const newEnd = newStart + duration;

    newStart = Math.max(timeScale.value.start, newStart);
    newEnd = Math.min(timeScale.value.end, newEnd);

    conflicts.value = checkConflicts(
      dragState.value.flightId,
      newStart,
      newEnd,
      dragState.value.serviceId || undefined
    );

    if (dragState.value.serviceId) {
      store.updateFlightService(
        dragState.value.flightId,
        dragState.value.serviceId,
        {
          startTime: newStart,
          endTime: newEnd,
        }
      );
    } else {
      store.updateFlight(dragState.value.flightId, {
        arrivalTime: newStart,
        departureTime: newEnd,
      });

      const flight = store.flightById(dragState.value.flightId);
      if (flight) {
        const originalArrival = dragState.value.originalStart;
        const timeShift = newStart - originalArrival;

        flight.services.forEach((service) => {
          store.updateFlightService(
            dragState.value.flightId!,
            service.id,
            {
              startTime: service.startTime + timeShift,
              endTime: service.endTime + timeShift,
            }
          );
        });
      }
    }
  };

  const endDrag = () => {
    if (dragState.value.flightId && conflicts.value.length > 0) {
      store.addAlert({
        level: 'red',
        type: 'resource-conflict',
        message: `资源冲突检测: ${conflicts.value.length} 处冲突需要处理`,
        flightId: dragState.value.flightId,
      });
    }

    dragState.value = {
      isDragging: false,
      flightId: null,
      serviceId: null,
      startX: 0,
      startTime: 0,
      originalStart: 0,
      originalEnd: 0,
    };

    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', endDrag);
  };

  const hasConflict = (flightId: string, serviceId?: string): boolean => {
    return conflicts.value.some(
      (c) => c.flightId === flightId && c.serviceId === serviceId
    );
  };

  return {
    dragState,
    conflicts,
    timeScale,
    timeToX,
    xToTime,
    startDrag,
    handleDrag,
    endDrag,
    checkConflicts,
    hasConflict,
  };
}

import { ref } from 'vue';
import { useApronStore } from '@/stores/apron';
import { MIN_TURNAROUND_INTERVAL } from '@/utils/constants';

interface DragState {
  isDragging: boolean;
  flightId: string | null;
  serviceId: string | null;
  startX: number;
  containerWidth: number;
  dayStart: number;
  dayEnd: number;
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
    containerWidth: 800,
    dayStart: 0,
    dayEnd: 0,
    originalStart: 0,
    originalEnd: 0,
  });

  const conflicts = ref<
    { flightId: string; serviceId?: string; type: string }[]
  >([]);

  const isDragging = () => dragState.value.isDragging;

  const timeToX = (time: number): number => {
    const { dayStart, dayEnd, containerWidth } = dragState.value;
    const total = dayEnd - dayStart;
    if (total === 0) return 0;
    return ((time - dayStart) / total) * containerWidth;
  };

  const xToTime = (x: number): number => {
    const { dayStart, dayEnd, containerWidth } = dragState.value;
    const total = dayEnd - dayStart;
    return dayStart + (x / containerWidth) * total;
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
      if (otherFlight.status === 'departed') continue;
      const overlap =
        (newStartTime >= otherFlight.arrivalTime &&
          newStartTime < otherFlight.departureTime) ||
        (newEndTime > otherFlight.arrivalTime &&
          newEndTime <= otherFlight.departureTime) ||
        (newStartTime <= otherFlight.arrivalTime &&
          newEndTime >= otherFlight.departureTime);
      const interval = otherFlight.arrivalTime - newEndTime;
      if (overlap || (interval > 0 && interval < MIN_TURNAROUND_INTERVAL)) {
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
    serviceId: string | undefined,
    containerWidth: number,
    dayStart: number,
    dayEnd: number
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
      containerWidth,
      dayStart,
      dayEnd,
      originalStart: startTime,
      originalEnd: endTime,
    };
  };

  const handleDrag = (clientX: number) => {
    if (!dragState.value.isDragging || !dragState.value.flightId) return;

    const dx = clientX;
    const timeDelta = xToTime(dx) - xToTime(0);

    const duration =
      dragState.value.originalEnd - dragState.value.originalStart;
    let newStart = dragState.value.originalStart + timeDelta;
    let newEnd = newStart + duration;

    newStart = Math.max(dragState.value.dayStart, newStart);
    newEnd = Math.min(dragState.value.dayEnd, newEnd);

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
      containerWidth: 800,
      dayStart: 0,
      dayEnd: 0,
      originalStart: 0,
      originalEnd: 0,
    };
  };

  const hasConflict = (flightId: string, _serviceId?: string): boolean => {
    return conflicts.value.some((c) => c.flightId === flightId);
  };

  return {
    isDragging,
    conflicts,
    timeToX,
    xToTime,
    startDrag,
    handleDrag,
    endDrag,
    checkConflicts,
    hasConflict,
  };
}

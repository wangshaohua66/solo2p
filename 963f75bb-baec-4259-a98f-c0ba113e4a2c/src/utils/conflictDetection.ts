import type { EventItem, ConflictResult, ConflictDetail, ScheduleSuggestion } from '@/types';
import { addDays, differenceInMinutes, isWithinInterval } from 'date-fns';

export function detectConflicts(
  newEvent: Partial<EventItem>,
  existingEvents: EventItem[]
): ConflictResult {
  const startTime = performance.now();
  const conflicts: ConflictDetail[] = [];
  const suggestions: ScheduleSuggestion[] = [];

  if (!newEvent.startDate || !newEvent.endDate || !newEvent.venueId) {
    return {
      hasConflict: false,
      conflicts: [],
      suggestions: [],
      detectionTime: 0,
    };
  }

  const venueEvents = existingEvents.filter(
    (e) => e.venueId === newEvent.venueId && 
           e.status !== 'cancelled' && 
           e.status !== 'rejected' &&
           e.status !== 'draft'
  );

  for (const event of venueEvents) {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    const newStart = new Date(newEvent.startDate);
    const newEnd = new Date(newEvent.endDate);

    const hasOverlap = isWithinInterval(eventStart, { start: newStart, end: newEnd }) ||
                       isWithinInterval(eventEnd, { start: newStart, end: newEnd }) ||
                       isWithinInterval(newStart, { start: eventStart, end: eventEnd }) ||
                       isWithinInterval(newEnd, { start: eventStart, end: eventEnd });

    if (hasOverlap) {
      const overlapDuration = Math.min(
        differenceInMinutes(eventEnd, newStart),
        differenceInMinutes(newEnd, eventStart),
        differenceInMinutes(eventEnd, eventStart),
        differenceInMinutes(newEnd, newStart)
      );

      const severity = overlapDuration > 120 ? 'high' : overlapDuration > 60 ? 'medium' : 'low';

      conflicts.push({
        type: 'schedule',
        description: `与"${event.name}"档期重叠，重叠时长约${Math.round(overlapDuration)}分钟`,
        conflictingEventId: event.id,
        conflictingEventName: event.name,
        conflictingTime: { start: eventStart, end: eventEnd },
        severity,
      });

      if (conflicts.length <= 3) {
        const beforeDate = addDays(eventStart, -2);
        const afterDate = addDays(eventEnd, 1);
        
        suggestions.push({
          alternativeDate: beforeDate,
          alternativeResources: newEvent.requiredResources || [],
          reason: `安排在"${event.name}"之前2天，档期宽松`,
          impactLevel: 'low',
        });
        
        suggestions.push({
          alternativeDate: afterDate,
          alternativeResources: newEvent.requiredResources || [],
          reason: `安排在"${event.name}"之后1天，设备无需重复转换`,
          impactLevel: 'low',
        });
      }
    }

    if (newEvent.requiredResources && newEvent.requiredResources.length > 0) {
      const sharedResources = newEvent.requiredResources.filter((r) =>
        event.requiredResources.includes(r)
      );

      if (sharedResources.length > 0 && hasOverlap) {
        conflicts.push({
          type: 'resource',
          description: `与"${event.name}"共享${sharedResources.length}项资源存在冲突`,
          conflictingEventId: event.id,
          conflictingEventName: event.name,
          severity: 'high',
        });
      }
    }

    if (newEvent.equipmentMode && event.equipmentMode !== newEvent.equipmentMode && hasOverlap) {
      conflicts.push({
        type: 'equipment',
        description: `设备模式冲突："${event.name}"为${event.equipmentMode === 'sports' ? '体育' : '演唱会'}模式`,
        conflictingEventId: event.id,
        conflictingEventName: event.name,
        severity: 'medium',
      });
    }
  }

  const detectionTime = performance.now() - startTime;

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    suggestions: suggestions.slice(0, 5),
    detectionTime,
  };
}

export function findOptimalSlot(
  venueId: string,
  durationMinutes: number,
  preferredDate: Date,
  existingEvents: EventItem[],
  requiredResources: string[] = []
): Date | null {
  const checkDate = new Date(preferredDate);
  
  for (let offset = 0; offset < 30; offset++) {
    for (let hour = 8; hour <= 22; hour++) {
      const candidateStart = new Date(checkDate);
      candidateStart.setHours(hour, 0, 0, 0);
      
      const candidateEnd = new Date(candidateStart);
      candidateEnd.setMinutes(candidateEnd.getMinutes() + durationMinutes);

      const mockEvent: Partial<EventItem> = {
        venueId,
        startDate: candidateStart,
        endDate: candidateEnd,
        requiredResources,
      };

      const result = detectConflicts(mockEvent, existingEvents);
      if (!result.hasConflict) {
        return candidateStart;
      }
    }
    
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return null;
}

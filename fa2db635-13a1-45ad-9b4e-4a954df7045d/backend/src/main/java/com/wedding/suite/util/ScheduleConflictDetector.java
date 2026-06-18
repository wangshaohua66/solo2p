package com.wedding.suite.util;

import com.wedding.suite.dto.response.ResourceVO;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.enums.ResourceType;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class ScheduleConflictDetector {

    public static boolean overlap(LocalDateTime aStart, LocalDateTime aEnd,
                                   LocalDateTime bStart, LocalDateTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    public List<ScheduleTaskEntity> detectConflict(List<ScheduleTaskEntity> tasks, ResourceType type,
                                                   Long resourceId, LocalDateTime start, LocalDateTime end) {
        return tasks.stream()
                .filter(t -> t.getResourceType() == type
                        && t.getResourceId().equals(resourceId)
                        && overlap(t.getStartTime(), t.getEndTime(), start, end))
                .collect(Collectors.toList());
    }

    public List<ResourceVO> recommendAlternatives(List<ResourceVO> candidates, List<ScheduleTaskEntity> tasks,
                                                  ResourceType type, LocalDateTime start, LocalDateTime end,
                                                  Long excludeId) {
        return candidates.stream()
                .filter(r -> type.name().equals(r.getType()))
                .filter(r -> !r.getId().equals(excludeId))
                .filter(r -> detectConflict(tasks, type, r.getId(), start, end).isEmpty())
                .limit(5)
                .collect(Collectors.toList());
    }
}

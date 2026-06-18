package com.wedding.suite.util;

import com.wedding.suite.dto.response.ResourceVO;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.enums.ResourceType;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class ScheduleConflictDetector {

    public static boolean overlap(LocalDateTime aStart, LocalDateTime aEnd,
                                   LocalDateTime bStart, LocalDateTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    private static final class IndexKey {
        final ResourceType type;
        final Long resourceId;

        IndexKey(ResourceType type, Long resourceId) {
            this.type = type;
            this.resourceId = resourceId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof IndexKey)) return false;
            IndexKey that = (IndexKey) o;
            return type == that.type && resourceId.equals(that.resourceId);
        }

        @Override
        public int hashCode() {
            return 31 * type.hashCode() + resourceId.hashCode();
        }
    }

    private Map<IndexKey, List<ScheduleTaskEntity>> buildIndex(List<ScheduleTaskEntity> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<IndexKey, List<ScheduleTaskEntity>> map = new HashMap<>();
        for (ScheduleTaskEntity t : tasks) {
            IndexKey k = new IndexKey(t.getResourceType(), t.getResourceId());
            map.computeIfAbsent(k, _k -> new ArrayList<>()).add(t);
        }
        for (var entry : map.entrySet()) {
            List<ScheduleTaskEntity> list = entry.getValue();
            list.sort(Comparator.comparing(ScheduleTaskEntity::getStartTime));
        }
        return map;
    }

    private int binarySearchFirstEndAfter(List<ScheduleTaskEntity> sorted, LocalDateTime end) {
        int lo = 0, hi = sorted.size();
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (sorted.get(mid).getEndTime().isAfter(end)) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        return lo;
    }

    public List<ScheduleTaskEntity> detectConflict(List<ScheduleTaskEntity> tasks, ResourceType type,
                                                   Long resourceId, LocalDateTime start, LocalDateTime end) {
        if (tasks == null || tasks.isEmpty()) {
            return Collections.emptyList();
        }
        Map<IndexKey, List<ScheduleTaskEntity>> idx = buildIndex(tasks);
        List<ScheduleTaskEntity> bucket = idx.get(new IndexKey(type, resourceId));
        if (bucket == null || bucket.isEmpty()) {
            return Collections.emptyList();
        }
        int from = binarySearchFirstEndAfter(bucket, start);
        List<ScheduleTaskEntity> result = new ArrayList<>();
        for (int i = from; i < bucket.size(); i++) {
            ScheduleTaskEntity t = bucket.get(i);
            if (!t.getStartTime().isBefore(end)) {
                break;
            }
            result.add(t);
        }
        return result;
    }

    public List<ResourceVO> recommendAlternatives(List<ResourceVO> candidates, List<ScheduleTaskEntity> tasks,
                                                  ResourceType type, LocalDateTime start, LocalDateTime end,
                                                  Long excludeId) {
        if (candidates == null || candidates.isEmpty()) {
            return Collections.emptyList();
        }
        Map<IndexKey, List<ScheduleTaskEntity>> idx = buildIndex(tasks);
        return candidates.stream()
                .filter(r -> type.name().equals(r.getType()))
                .filter(r -> excludeId == null || !r.getId().equals(excludeId))
                .filter(r -> {
                    List<ScheduleTaskEntity> bucket = idx.get(new IndexKey(type, r.getId()));
                    if (bucket == null || bucket.isEmpty()) {
                        return true;
                    }
                    int from = binarySearchFirstEndAfter(bucket, start);
                    for (int i = from; i < bucket.size(); i++) {
                        ScheduleTaskEntity t = bucket.get(i);
                        if (!t.getStartTime().isBefore(end)) {
                            break;
                        }
                        return false;
                    }
                    return true;
                })
                .limit(5)
                .collect(Collectors.toList());
    }
}

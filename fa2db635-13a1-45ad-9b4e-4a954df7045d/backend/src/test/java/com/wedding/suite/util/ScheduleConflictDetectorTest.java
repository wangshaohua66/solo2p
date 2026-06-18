package com.wedding.suite.util;

import com.wedding.suite.dto.response.ResourceVO;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.enums.ResourceType;
import com.wedding.suite.enums.ScheduleStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ScheduleConflictDetector 单元测试")
class ScheduleConflictDetectorTest {

    private ScheduleConflictDetector detector;
    private List<ScheduleTaskEntity> tasks;

    @BeforeEach
    void setUp() {
        detector = new ScheduleConflictDetector();
        tasks = new ArrayList<>();
        LocalDateTime base = LocalDateTime.of(2026, 10, 1, 10, 0);
        for (int i = 0; i < 5; i++) {
            tasks.add(ScheduleTaskEntity.builder()
                    .id((long) (i + 1))
                    .resourceType(ResourceType.STAFF)
                    .resourceId(1L)
                    .resourceName("人员" + i)
                    .startTime(base.plusMinutes((long) i * 60))
                    .endTime(base.plusMinutes((long) (i + 1) * 60))
                    .status(ScheduleStatus.BOOKED)
                    .build());
        }
    }

    @Test
    @DisplayName("overlap: 完全包含时重叠")
    void overlap_fullyContained_returnsTrue() {
        LocalDateTime aS = LocalDateTime.of(2026, 10, 1, 10, 0);
        LocalDateTime aE = LocalDateTime.of(2026, 10, 1, 12, 0);
        LocalDateTime bS = LocalDateTime.of(2026, 10, 1, 11, 0);
        LocalDateTime bE = LocalDateTime.of(2026, 10, 1, 11, 30);
        assertTrue(ScheduleConflictDetector.overlap(aS, aE, bS, bE));
    }

    @Test
    @DisplayName("overlap: 部分重叠")
    void overlap_partial_returnsTrue() {
        LocalDateTime aS = LocalDateTime.of(2026, 10, 1, 10, 0);
        LocalDateTime aE = LocalDateTime.of(2026, 10, 1, 11, 0);
        LocalDateTime bS = LocalDateTime.of(2026, 10, 1, 10, 30);
        LocalDateTime bE = LocalDateTime.of(2026, 10, 1, 11, 30);
        assertTrue(ScheduleConflictDetector.overlap(aS, aE, bS, bE));
    }

    @Test
    @DisplayName("overlap: 边界相邻不重叠")
    void overlap_adjacent_returnsFalse() {
        LocalDateTime aS = LocalDateTime.of(2026, 10, 1, 10, 0);
        LocalDateTime aE = LocalDateTime.of(2026, 10, 1, 11, 0);
        LocalDateTime bS = LocalDateTime.of(2026, 10, 1, 11, 0);
        LocalDateTime bE = LocalDateTime.of(2026, 10, 1, 12, 0);
        assertFalse(ScheduleConflictDetector.overlap(aS, aE, bS, bE));
    }

    @Test
    @DisplayName("overlap: 完全不重叠")
    void overlap_noOverlap_returnsFalse() {
        LocalDateTime aS = LocalDateTime.of(2026, 10, 1, 10, 0);
        LocalDateTime aE = LocalDateTime.of(2026, 10, 1, 11, 0);
        LocalDateTime bS = LocalDateTime.of(2026, 10, 1, 12, 0);
        LocalDateTime bE = LocalDateTime.of(2026, 10, 1, 13, 0);
        assertFalse(ScheduleConflictDetector.overlap(aS, aE, bS, bE));
    }

    @Test
    @DisplayName("detectConflict: 检测到冲突")
    void detectConflict_foundConflict_returnsConflicting() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 1, 10, 30);
        LocalDateTime end = LocalDateTime.of(2026, 10, 1, 11, 30);
        List<ScheduleTaskEntity> result = detector.detectConflict(tasks, ResourceType.STAFF, 1L, start, end);
        assertFalse(result.isEmpty());
        assertEquals(2, result.size());
    }

    @Test
    @DisplayName("detectConflict: 不同资源类型不冲突")
    void detectConflict_differentType_noConflict() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 1, 10, 30);
        LocalDateTime end = LocalDateTime.of(2026, 10, 1, 11, 30);
        List<ScheduleTaskEntity> result = detector.detectConflict(tasks, ResourceType.VENUE, 1L, start, end);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("detectConflict: 不同资源ID不冲突")
    void detectConflict_differentResourceId_noConflict() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 1, 10, 30);
        LocalDateTime end = LocalDateTime.of(2026, 10, 1, 11, 30);
        List<ScheduleTaskEntity> result = detector.detectConflict(tasks, ResourceType.STAFF, 99L, start, end);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("recommendAlternatives: 返回不冲突的备选资源")
    void recommendAlternatives_findsAlternatives() {
        List<ResourceVO> candidates = List.of(
                new ResourceVO(1L, "STAFF", "人员1", 1L, ""),
                new ResourceVO(2L, "STAFF", "人员2", 1L, ""),
                new ResourceVO(3L, "STAFF", "人员3", 1L, ""),
                new ResourceVO(4L, "STAFF", "人员4", 1L, ""),
                new ResourceVO(5L, "STAFF", "人员5", 1L, "")
        );
        LocalDateTime start = LocalDateTime.of(2026, 10, 1, 10, 30);
        LocalDateTime end = LocalDateTime.of(2026, 10, 1, 11, 30);
        List<ResourceVO> result = detector.recommendAlternatives(candidates, tasks, ResourceType.STAFF, start, end, 1L);
        assertFalse(result.isEmpty());
        assertEquals(4, result.size());
        assertTrue(result.stream().noneMatch(r -> r.getId().equals(1L)));
    }

    @Test
    @DisplayName("recommendAlternatives: 最多返回5个备选")
    void recommendAlternatives_limitToFive() {
        List<ResourceVO> candidates = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            candidates.add(new ResourceVO((long) i, "VENUE", "场地" + i, 1L, ""));
        }
        LocalDateTime start = LocalDateTime.of(2026, 10, 1, 10, 0);
        LocalDateTime end = LocalDateTime.of(2026, 10, 1, 11, 0);
        List<ResourceVO> result = detector.recommendAlternatives(candidates, tasks, ResourceType.VENUE, start, end, null);
        assertEquals(5, result.size());
    }

    @Test
    @DisplayName("recommendAlternatives: 类型不匹配过滤")
    void recommendAlternatives_typeMismatch_filtered() {
        List<ResourceVO> candidates = List.of(
                new ResourceVO(1L, "STAFF", "人员1", 1L, ""),
                new ResourceVO(2L, "VENUE", "场地1", 1L, "")
        );
        LocalDateTime start = LocalDateTime.of(2026, 10, 1, 10, 0);
        LocalDateTime end = LocalDateTime.of(2026, 10, 1, 11, 0);
        List<ResourceVO> result = detector.recommendAlternatives(candidates, tasks, ResourceType.VENUE, start, end, null);
        assertEquals(1, result.size());
        assertEquals("VENUE", result.get(0).getType());
    }
}

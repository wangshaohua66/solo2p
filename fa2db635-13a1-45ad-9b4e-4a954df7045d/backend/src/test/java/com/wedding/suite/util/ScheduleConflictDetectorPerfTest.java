package com.wedding.suite.util;

import com.wedding.suite.dto.response.ResourceVO;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.enums.ResourceType;
import com.wedding.suite.enums.ScheduleStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ScheduleConflictDetector 性能基准测试")
class ScheduleConflictDetectorPerfTest {

    private static final int TASKS_PER_DAY_PER_RESOURCE = 8;
    private static final int RESOURCES = 125;
    private static final int DAYS = 60;
    private static final int TOTAL_TASKS = TASKS_PER_DAY_PER_RESOURCE * RESOURCES * DAYS;
    private static final int CONCURRENT = 1000;
    private static final long THRESHOLD_MS = 500L;

    private ScheduleConflictDetector detector;
    private List<ScheduleTaskEntity> massiveTasks;
    private List<ResourceVO> candidates;
    private List<ConflictQuery> queries;

    @BeforeEach
    void setUp() {
        detector = new ScheduleConflictDetector();
        massiveTasks = new ArrayList<>(TOTAL_TASKS);
        Random rnd = new Random(42);
        LocalDate start = LocalDate.of(2026, 1, 1);
        int id = 1;
        for (int r = 1; r <= RESOURCES; r++) {
            ResourceType type = ResourceType.values()[r % 3];
            for (int d = 0; d < DAYS; d++) {
                LocalDate day = start.plusDays(d);
                for (int s = 0; s < TASKS_PER_DAY_PER_RESOURCE; s++) {
                    int hour = 8 + s;
                    massiveTasks.add(ScheduleTaskEntity.builder()
                            .id((long) id++)
                            .resourceType(type)
                            .resourceId((long) r)
                            .resourceName(type + "-" + r)
                            .startTime(LocalDateTime.of(day, LocalTime.of(hour, 0)))
                            .endTime(LocalDateTime.of(day, LocalTime.of(hour + 1, 0)))
                            .status(ScheduleStatus.BOOKED)
                            .build());
                }
            }
        }
        assertEquals(TOTAL_TASKS, massiveTasks.size());

        candidates = new ArrayList<>();
        for (int i = 1; i <= RESOURCES; i++) {
            ResourceType type = ResourceType.values()[i % 3];
            candidates.add(new ResourceVO((long) i, type.name(), "R" + i, 1L, ""));
        }

        queries = new ArrayList<>(CONCURRENT);
        for (int i = 0; i < CONCURRENT; i++) {
            LocalDate day = start.plusDays(rnd.nextInt(DAYS));
            int hour = 9 + rnd.nextInt(8);
            ResourceType type = ResourceType.values()[rnd.nextInt(3)];
            long rid = 1L + rnd.nextInt(RESOURCES);
            queries.add(new ConflictQuery(type, rid,
                    LocalDateTime.of(day, LocalTime.of(hour, 0)),
                    LocalDateTime.of(day, LocalTime.of(hour + 1, 0))));
        }
    }

    @Test
    @DisplayName("基准：单个 detectConflict 响应时间 < " + THRESHOLD_MS + "ms")
    void perf_singleDetect_belowThreshold() {
        ConflictQuery q = queries.get(0);
        warmup(q, 100);

        long startNs = System.nanoTime();
        detector.detectConflict(massiveTasks, q.type, q.resourceId, q.start, q.end);
        long costMs = (System.nanoTime() - startNs) / 1_000_000L;

        System.out.println("[PERF] Single detectConflict: " + costMs + "ms / " + TOTAL_TASKS + " tasks");
        assertTrue(costMs < THRESHOLD_MS,
                "单个 detectConflict 耗时 " + costMs + "ms 超过阈值 " + THRESHOLD_MS + "ms");
    }

    @Test
    @DisplayName("基准：单个 recommendAlternatives 响应时间 < " + THRESHOLD_MS + "ms")
    void perf_singleRecommend_belowThreshold() {
        ConflictQuery q = queries.get(0);
        warmupRecommend(q, 50);

        long startNs = System.nanoTime();
        detector.recommendAlternatives(candidates, massiveTasks, q.type, q.start, q.end, q.resourceId);
        long costMs = (System.nanoTime() - startNs) / 1_000_000L;

        System.out.println("[PERF] Single recommendAlternatives: " + costMs + "ms / "
                + TOTAL_TASKS + " tasks, " + candidates.size() + " candidates");
        assertTrue(costMs < THRESHOLD_MS,
                "单个 recommendAlternatives 耗时 " + costMs + "ms 超过阈值 " + THRESHOLD_MS + "ms");
    }

    @Test
    @DisplayName("并发：" + CONCURRENT + " 个 detectConflict 同时执行，平均响应时间 < " + THRESHOLD_MS + "ms")
    void perf_concurrentDetect_1000_belowThreshold() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
        try {
            CountDownLatch ready = new CountDownLatch(CONCURRENT);
            CountDownLatch start = new CountDownLatch(1);
            AtomicLong totalCostNs = new AtomicLong(0);
            AtomicLong errorCount = new AtomicLong(0);
            List<Future<?>> futures = new ArrayList<>(CONCURRENT);

            for (int i = 0; i < CONCURRENT; i++) {
                final ConflictQuery q = queries.get(i);
                futures.add(pool.submit(() -> {
                    try {
                        ready.countDown();
                        start.await();
                        long s = System.nanoTime();
                        List<ScheduleTaskEntity> result = detector.detectConflict(
                                massiveTasks, q.type, q.resourceId, q.start, q.end);
                        long cost = System.nanoTime() - s;
                        totalCostNs.addAndGet(cost);
                        assertNotNull(result);
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    }
                }));
            }

            ready.await(30, TimeUnit.SECONDS);
            long runStart = System.nanoTime();
            start.countDown();
            for (Future<?> f : futures) f.get(60, TimeUnit.SECONDS);
            long wallMs = (System.nanoTime() - runStart) / 1_000_000L;
            double avgMs = (totalCostNs.get() / (double) CONCURRENT) / 1_000_000.0;

            System.out.println("[PERF] Concurrent detectConflict x" + CONCURRENT
                    + ": wall=" + wallMs + "ms, avg=" + String.format("%.2f", avgMs) + "ms, errors=" + errorCount.get());

            assertEquals(0, errorCount.get(), "并发执行不应出现异常");
            assertTrue(avgMs < THRESHOLD_MS,
                    "平均 detectConflict 耗时 " + String.format("%.2f", avgMs) + "ms 超过阈值 " + THRESHOLD_MS + "ms");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("并发：" + CONCURRENT + " 个 recommendAlternatives 同时执行，平均 < " + THRESHOLD_MS + "ms")
    void perf_concurrentRecommend_1000_belowThreshold() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
        try {
            CountDownLatch ready = new CountDownLatch(CONCURRENT);
            CountDownLatch start = new CountDownLatch(1);
            AtomicLong totalCostNs = new AtomicLong(0);
            AtomicLong errorCount = new AtomicLong(0);
            List<Future<?>> futures = new ArrayList<>(CONCURRENT);

            for (int i = 0; i < CONCURRENT; i++) {
                final ConflictQuery q = queries.get(i);
                futures.add(pool.submit(() -> {
                    try {
                        ready.countDown();
                        start.await();
                        long s = System.nanoTime();
                        List<ResourceVO> result = detector.recommendAlternatives(
                                candidates, massiveTasks, q.type, q.start, q.end, q.resourceId);
                        long cost = System.nanoTime() - s;
                        totalCostNs.addAndGet(cost);
                        assertNotNull(result);
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    }
                }));
            }

            ready.await(30, TimeUnit.SECONDS);
            long runStart = System.nanoTime();
            start.countDown();
            for (Future<?> f : futures) f.get(120, TimeUnit.SECONDS);
            long wallMs = (System.nanoTime() - runStart) / 1_000_000L;
            double avgMs = (totalCostNs.get() / (double) CONCURRENT) / 1_000_000.0;

            System.out.println("[PERF] Concurrent recommendAlternatives x" + CONCURRENT
                    + ": wall=" + wallMs + "ms, avg=" + String.format("%.2f", avgMs) + "ms, errors=" + errorCount.get());

            assertEquals(0, errorCount.get(), "并发执行不应出现异常");
            assertTrue(avgMs < THRESHOLD_MS,
                    "平均 recommendAlternatives 耗时 " + String.format("%.2f", avgMs) + "ms 超过阈值 " + THRESHOLD_MS + "ms");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("吞吐：数据集规模 60000 任务时整体检测正确性验证")
    void perf_correctness_underScale() {
        ConflictQuery q = new ConflictQuery(ResourceType.STAFF, 3L,
                LocalDateTime.of(2026, 1, 1, 10, 0),
                LocalDateTime.of(2026, 1, 1, 11, 0));
        List<ScheduleTaskEntity> conflicts = detector.detectConflict(
                massiveTasks, q.type, q.resourceId, q.start, q.end);
        assertEquals(1, conflicts.size(), "10:00-11:00 时间段 STAFF-3 应有 exactly 1 条任务");
        assertEquals(10, conflicts.get(0).getStartTime().getHour());
    }

    private void warmup(ConflictQuery q, int times) {
        for (int i = 0; i < times; i++) {
            detector.detectConflict(massiveTasks, q.type, q.resourceId, q.start, q.end);
        }
    }

    private void warmupRecommend(ConflictQuery q, int times) {
        for (int i = 0; i < times; i++) {
            detector.recommendAlternatives(candidates, massiveTasks, q.type, q.start, q.end, q.resourceId);
        }
    }

    private static final class ConflictQuery {
        final ResourceType type;
        final long resourceId;
        final LocalDateTime start;
        final LocalDateTime end;

        ConflictQuery(ResourceType type, long resourceId, LocalDateTime start, LocalDateTime end) {
            this.type = type;
            this.resourceId = resourceId;
            this.start = start;
            this.end = end;
        }
    }
}

package com.notarization.service.impl;

import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.NotarizationCase;
import com.notarization.model.StatisticRecord;
import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.NotarizationType;
import com.notarization.model.enums.WorkflowAction;
import com.notarization.repository.NotarizationRepository;
import com.notarization.repository.StatisticRepository;
import com.notarization.service.StatisticService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StatisticServiceImpl implements StatisticService {

    private final StatisticRepository statisticRepository;
    private final NotarizationRepository notarizationRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    @Scheduled(cron = "0 0 2 * * ?")
    public StatisticRecord generateDailyStatistic() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("开始生成每日统计: {}", yesterday);
        return generateStatistic(StatisticRecord.PeriodType.DAILY, yesterday, yesterday);
    }

    @Override
    @Scheduled(cron = "0 0 3 1 * ?")
    public StatisticRecord generateMonthlyStatistic() {
        LocalDate now = LocalDate.now();
        LocalDate firstDayOfLastMonth = now.minusMonths(1).withDayOfMonth(1);
        LocalDate lastDayOfLastMonth = now.withDayOfMonth(1).minusDays(1);
        log.info("开始生成每月统计: {} ~ {}", firstDayOfLastMonth, lastDayOfLastMonth);
        return generateStatistic(StatisticRecord.PeriodType.MONTHLY, firstDayOfLastMonth, lastDayOfLastMonth);
    }

    @Override
    @Scheduled(cron = "0 0 4 1 1,4,7,10 ?")
    public StatisticRecord generateQuarterlyStatistic() {
        LocalDate now = LocalDate.now();
        int currentMonth = now.getMonthValue();
        int currentQuarterStartMonth = ((currentMonth - 1) / 3) * 3 + 1;
        LocalDate currentQuarterStart = now.withMonth(currentQuarterStartMonth).withDayOfMonth(1);
        LocalDate lastQuarterEnd = currentQuarterStart.minusDays(1);

        int lastQuarterStartMonth = ((lastQuarterEnd.getMonthValue() - 1) / 3) * 3 + 1;
        LocalDate lastQuarterStart = lastQuarterEnd.withMonth(lastQuarterStartMonth).withDayOfMonth(1);

        log.info("开始生成每季度统计: {} ~ {}", lastQuarterStart, lastQuarterEnd);
        return generateStatistic(StatisticRecord.PeriodType.QUARTERLY, lastQuarterStart, lastQuarterEnd);
    }

    @Override
    public List<StatisticRecord> getStatistics(String periodType, LocalDate start, LocalDate end) {
        StatisticRecord.PeriodType type = StatisticRecord.PeriodType.valueOf(periodType);
        Instant startInstant = start.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant endInstant = end.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        return statisticRepository.findByPeriodTypeAndCreatedAtBetween(type, startInstant, endInstant);
    }

    @Override
    public StatisticRecord getLatestStatistic(String periodType) {
        StatisticRecord.PeriodType type = StatisticRecord.PeriodType.valueOf(periodType);
        return statisticRepository.findFirstByPeriodTypeOrderByCreatedAtDesc(type)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAM_INVALID, "统计记录不存在"));
    }

    private StatisticRecord generateStatistic(StatisticRecord.PeriodType periodType, LocalDate startDate, LocalDate endDate) {
        Instant startInstant = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant endInstant = endDate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();

        Query query = new Query();
        query.addCriteria(Criteria.where("createdAt").gte(startInstant).lt(endInstant));
        List<NotarizationCase> cases = mongoTemplate.find(query, NotarizationCase.class);

        int totalCount = cases.size();

        Map<NotarizationType, Long> typeStats = cases.stream()
                .filter(c -> c.getCaseType() != null)
                .collect(Collectors.groupingBy(NotarizationCase::getCaseType, Collectors.counting()));

        double avgDurationHours = calculateAvgDurationHours(cases);

        double supplementRate = calculateSupplementRate(cases, totalCount);

        Map<String, Integer> notaryWorkload = aggregateNotaryWorkload(cases);

        double foreignRate = calculateForeignRate(cases, totalCount);

        StatisticRecord record = StatisticRecord.builder()
                .id(generateUUID())
                .periodType(periodType)
                .startDate(startDate)
                .endDate(endDate)
                .typeStats(typeStats)
                .avgDurationHours(avgDurationHours)
                .supplementRate(supplementRate)
                .notaryWorkload(notaryWorkload)
                .foreignRate(foreignRate)
                .createdAt(Instant.now())
                .build();

        return statisticRepository.save(record);
    }

    private double calculateAvgDurationHours(List<NotarizationCase> cases) {
        List<Long> durations = new ArrayList<>();

        for (NotarizationCase c : cases) {
            if (CaseStatus.CERTIFIED.equals(c.getStatus()) || CaseStatus.ARCHIVED.equals(c.getStatus())) {
                Instant certifiedTime = extractCertifiedTime(c);
                if (certifiedTime != null && c.getCreatedAt() != null) {
                    long hours = Duration.between(c.getCreatedAt(), certifiedTime).toHours();
                    durations.add(hours);
                }
            }
        }

        if (durations.isEmpty()) {
            return 0.0;
        }

        return durations.stream().mapToLong(Long::longValue).average().orElse(0.0);
    }

    private Instant extractCertifiedTime(NotarizationCase c) {
        if (c.getWorkflowHistory() == null) {
            return null;
        }
        for (NotarizationCase.WorkflowRecord record : c.getWorkflowHistory()) {
            if (CaseStatus.CERTIFIED.equals(record.getStatusTo())) {
                return record.getTimestamp();
            }
        }
        return null;
    }

    private double calculateSupplementRate(List<NotarizationCase> cases, int totalCount) {
        if (totalCount == 0) {
            return 0.0;
        }

        long supplementCount = cases.stream()
                .filter(c -> {
                    if (c.getWorkflowHistory() == null) {
                        return false;
                    }
                    return c.getWorkflowHistory().stream()
                            .anyMatch(r -> WorkflowAction.REQUEST_SUPPLEMENT.equals(r.getAction()));
                })
                .count();

        return (double) supplementCount / totalCount;
    }

    private Map<String, Integer> aggregateNotaryWorkload(List<NotarizationCase> cases) {
        Map<String, Integer> workload = new HashMap<>();
        for (NotarizationCase c : cases) {
            String notaryId = c.getAssignedNotaryId();
            if (notaryId != null && !notaryId.isEmpty()) {
                workload.merge(notaryId, 1, Integer::sum);
            }
        }
        return workload;
    }

    private double calculateForeignRate(List<NotarizationCase> cases, int totalCount) {
        if (totalCount == 0) {
            return 0.0;
        }

        long foreignCount = cases.stream()
                .filter(c -> NotarizationType.FOREIGN.equals(c.getCaseType()))
                .count();

        return (double) foreignCount / totalCount;
    }

    private String generateUUID() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}

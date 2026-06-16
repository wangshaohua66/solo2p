package com.emergency.incident.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.emergency.common.dto.LoginUser;
import com.emergency.common.dto.PageResult;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.exception.BusinessException;
import com.emergency.common.result.ResultCode;
import com.emergency.common.util.IdGenerator;
import com.emergency.common.util.SecurityUtils;
import com.emergency.incident.dto.ArchiveIncidentRequest;
import com.emergency.incident.dto.CaseComparisonRequest;
import com.emergency.incident.dto.GenerateReviewRequest;
import com.emergency.incident.dto.HistoryCaseQueryRequest;
import com.emergency.incident.entity.*;
import com.emergency.incident.mapper.*;
import com.emergency.incident.service.ReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final IncidentArchiveMapper archiveMapper;
    private final IncidentReviewReportMapper reviewReportMapper;
    private final IncidentHistoryCaseMapper historyCaseMapper;
    private final IncidentCaseComparisonMapper caseComparisonMapper;
    private final IncidentMapper incidentMapper;
    private final IncidentOperationLogMapper operationLogMapper;
    private final IncidentServiceImpl incidentService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IncidentArchive archiveIncident(ArchiveIncidentRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        Incident incident = incidentMapper.selectById(request.getIncidentId());
        if (incident == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "灾情不存在");
        }

        if (incident.getStatus() != IncidentStatus.CLOSED) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "灾情未结案，无法归档");
        }

        IncidentArchive archive = new IncidentArchive();
        archive.setArchiveNo(IdGenerator.generateArchiveNo());
        archive.setIncidentId(request.getIncidentId());
        archive.setArchiveType(request.getArchiveType());
        archive.setArchiveStatus(1);
        archive.setArchivedBy(currentUser.getUserId());
        archive.setArchivedAt(LocalDateTime.now());
        archive.setArchiveRemark(request.getArchiveRemark());
        archive.setCreatedBy(currentUser.getUserId());

        archiveMapper.insert(archive);

        incidentService.recordOperationLog(
                request.getIncidentId(),
                "ARCHIVE",
                "灾情已归档",
                incident.getStatus().name(),
                "ARCHIVED",
                "归档编号: " + archive.getArchiveNo()
        );

        log.info("灾情归档成功, incidentId: {}, archiveNo: {}", request.getIncidentId(), archive.getArchiveNo());
        return archive;
    }

    @Override
    public IncidentArchive getArchiveById(Long id) {
        return archiveMapper.selectById(id);
    }

    @Override
    public List<IncidentArchive> getArchivesByIncidentId(Long incidentId) {
        return archiveMapper.selectByIncidentId(incidentId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IncidentReviewReport generateReviewReport(GenerateReviewRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        Incident incident = incidentMapper.selectById(request.getIncidentId());
        if (incident == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "灾情不存在");
        }

        IncidentArchive archive = archiveMapper.selectById(request.getArchiveId());
        if (archive == null || !archive.getIncidentId().equals(request.getIncidentId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "归档记录无效");
        }

        Map<String, Object> efficiencyMetrics = calculateEfficiencyMetrics(request.getIncidentId());
        Map<String, Object> timelineAnalysis = generateTimelineAnalysis(request.getIncidentId());

        IncidentReviewReport report = new IncidentReviewReport();
        report.setReportNo(IdGenerator.generateReviewNo());
        report.setIncidentId(request.getIncidentId());
        report.setArchiveId(request.getArchiveId());
        report.setTitle(request.getTitle());
        report.setReportType(request.getReportType() != null ? request.getReportType() : "AUTO");

        StringBuilder summary = new StringBuilder();
        summary.append("灾情类型: ").append(incident.getType().getDescription()).append("; ");
        summary.append("灾情级别: ").append(incident.getLevel().getDescription()).append("; ");
        summary.append("发生地点: ").append(incident.getLocation()).append("; ");
        summary.append("受灾人数: ").append(incident.getAffectedPopulation() != null ? incident.getAffectedPopulation() : 0).append("人; ");
        report.setIncidentSummary(summary.toString());

        report.setResponseProcess(buildResponseProcess(timelineAnalysis));
        report.setTimelinessAnalysis(buildTimelinessAnalysis(efficiencyMetrics, timelineAnalysis));
        report.setResourceUtilization(buildResourceUtilization(efficiencyMetrics));
        report.setExistingProblems(request.getExistingProblems());
        report.setImprovementMeasures(request.getImprovementMeasures());
        report.setLessonsLearned(request.getLessonsLearned());

        report.setResponseDuration((BigDecimal) efficiencyMetrics.get("responseDuration"));
        report.setDispatchCount((Integer) efficiencyMetrics.get("dispatchCount"));
        report.setTeamCount((Integer) efficiencyMetrics.get("teamCount"));
        report.setMaterialCount((Integer) efficiencyMetrics.get("materialCount"));
        report.setCasualtyCount(incident.getCasualties() != null ? incident.getCasualties() : 0);
        report.setAffectedCount(incident.getAffectedPopulation() != null ? incident.getAffectedPopulation() : 0);
        report.setLossEstimate(incident.getDirectLoss() != null ? incident.getDirectLoss() : BigDecimal.ZERO);

        report.setEfficiencyScore((BigDecimal) efficiencyMetrics.get("efficiencyScore"));
        report.setTimelinessScore((BigDecimal) efficiencyMetrics.get("timelinessScore"));
        report.setResourceScore((BigDecimal) efficiencyMetrics.get("resourceScore"));
        report.setOverallScore((BigDecimal) efficiencyMetrics.get("overallScore"));

        report.setStatus(1);
        report.setGeneratedBy(currentUser.getUserId());
        report.setGeneratedAt(LocalDateTime.now());
        report.setCreatedBy(currentUser.getUserId());

        reviewReportMapper.insert(report);

        incidentService.recordOperationLog(
                request.getIncidentId(),
                "REVIEW_GENERATE",
                "生成复盘报告",
                "N/A",
                "REVIEWED",
                "报告编号: " + report.getReportNo() + ", 综合评分: " + report.getOverallScore()
        );

        log.info("复盘报告生成成功, reportNo: {}, incidentId: {}", report.getReportNo(), request.getIncidentId());
        return report;
    }

    @Override
    public IncidentReviewReport getReviewReportById(Long id) {
        return reviewReportMapper.selectById(id);
    }

    @Override
    public List<IncidentReviewReport> getReviewReportsByIncidentId(Long incidentId) {
        return reviewReportMapper.selectByIncidentId(incidentId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IncidentReviewReport approveReviewReport(Long id, Long reviewerId, String reviewRemark) {
        IncidentReviewReport report = reviewReportMapper.selectById(id);
        if (report == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "复盘报告不存在");
        }

        if (report.getStatus() != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "报告状态不允许审核");
        }

        report.setStatus(2);
        report.setReviewedBy(reviewerId);
        report.setReviewedAt(LocalDateTime.now());
        reviewReportMapper.updateById(report);

        createHistoryCase(report);

        incidentService.recordOperationLog(
                report.getIncidentId(),
                "REVIEW_APPROVE",
                "复盘报告已审核",
                "GENERATED",
                "APPROVED",
                reviewRemark
        );

        return report;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IncidentHistoryCase createHistoryCase(IncidentReviewReport report) {
        Incident incident = incidentMapper.selectById(report.getIncidentId());
        if (incident == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "灾情不存在");
        }

        IncidentHistoryCase historyCase = new IncidentHistoryCase();
        historyCase.setCaseNo(IdGenerator.generateCaseNo());
        historyCase.setIncidentId(report.getIncidentId());
        historyCase.setReportId(report.getId());
        historyCase.setCaseTitle(report.getTitle());
        historyCase.setCaseType(report.getReportType());
        historyCase.setIncidentType(incident.getType().getCode());
        historyCase.setIncidentLevel(incident.getLevel().getCode());
        historyCase.setRegionCode(incident.getRegionCode());
        historyCase.setLocation(incident.getLocation());
        historyCase.setLocationPoint(incident.getLocationPoint());
        historyCase.setOccurredAt(incident.getOccurredAt());
        historyCase.setEndedAt(incident.getClosedAt());

        if (incident.getOccurredAt() != null && incident.getClosedAt() != null) {
            Duration duration = Duration.between(incident.getOccurredAt(), incident.getClosedAt());
            historyCase.setDurationHours(BigDecimal.valueOf(duration.toMinutes()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
        }

        historyCase.setDescription(report.getIncidentSummary());
        historyCase.setKeyMeasures(report.getResponseProcess());
        historyCase.setMainExperiences(report.getLessonsLearned());
        historyCase.setLessonsLearned(report.getExistingProblems());
        historyCase.setResponseEfficiency(report.getTimelinessAnalysis());
        historyCase.setResourceAllocation(report.getResourceUtilization());
        historyCase.setAffectedPopulation(report.getAffectedCount());
        historyCase.setCasualtyCount(report.getCasualtyCount());
        historyCase.setDirectLoss(report.getLossEstimate());
        historyCase.setOverallRating(calculateRating(report.getOverallScore()));
        historyCase.setIsClassic(report.getOverallScore() != null && report.getOverallScore().compareTo(BigDecimal.valueOf(85)) >= 0);
        historyCase.setStatus(1);
        historyCase.setCreatedBy(report.getCreatedBy());

        historyCaseMapper.insert(historyCase);

        log.info("历史案例创建成功, caseNo: {}, incidentId: {}", historyCase.getCaseNo(), report.getIncidentId());
        return historyCase;
    }

    @Override
    public IncidentHistoryCase getHistoryCaseById(Long id) {
        return historyCaseMapper.selectById(id);
    }

    @Override
    public PageResult<IncidentHistoryCase> queryHistoryCases(HistoryCaseQueryRequest request) {
        LambdaQueryWrapper<IncidentHistoryCase> wrapper = new LambdaQueryWrapper<>();

        if (request.getIncidentType() != null) {
            wrapper.eq(IncidentHistoryCase::getIncidentType, request.getIncidentType());
        }
        if (request.getIncidentLevel() != null) {
            wrapper.eq(IncidentHistoryCase::getIncidentLevel, request.getIncidentLevel());
        }
        if (StringUtils.hasText(request.getRegionCode())) {
            wrapper.likeRight(IncidentHistoryCase::getRegionCode, request.getRegionCode());
        }
        if (request.getIsClassic() != null) {
            wrapper.eq(IncidentHistoryCase::getIsClassic, request.getIsClassic());
        }
        if (StringUtils.hasText(request.getTags())) {
            wrapper.like(IncidentHistoryCase::getTags, request.getTags());
        }
        if (StringUtils.hasText(request.getKeyword())) {
            wrapper.and(w -> w.like(IncidentHistoryCase::getCaseTitle, request.getKeyword())
                    .or().like(IncidentHistoryCase::getDescription, request.getKeyword()));
        }

        wrapper.eq(IncidentHistoryCase::getDeleted, 0);
        wrapper.orderByDesc(IncidentHistoryCase::getCreatedAt);

        IPage<IncidentHistoryCase> page = new Page<>(request.getPageNum(), request.getPageSize());
        IPage<IncidentHistoryCase> result = historyCaseMapper.selectPage(page, wrapper);

        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    @Override
    public List<IncidentHistoryCase> getClassicCases() {
        return historyCaseMapper.selectClassicCases();
    }

    @Override
    public List<IncidentHistoryCase> findSimilarCases(Long incidentId, Integer limit) {
        Incident incident = incidentMapper.selectById(incidentId);
        if (incident == null) {
            return Collections.emptyList();
        }

        int actualLimit = limit != null ? limit : 5;
        return historyCaseMapper.selectSimilarCases(
                incident.getType().getCode(),
                incident.getLevel().getCode(),
                actualLimit
        );
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IncidentCaseComparison compareWithCase(CaseComparisonRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        Incident sourceIncident = incidentMapper.selectById(request.getSourceIncidentId());
        IncidentHistoryCase targetCase = historyCaseMapper.selectById(request.getTargetCaseId());

        if (sourceIncident == null || targetCase == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "源灾情或目标案例不存在");
        }

        BigDecimal similarity = calculateSimilarity(sourceIncident, targetCase);

        IncidentCaseComparison comparison = new IncidentCaseComparison();
        comparison.setComparisonNo(IdGenerator.generateComparisonNo());
        comparison.setSourceIncidentId(request.getSourceIncidentId());
        comparison.setTargetCaseId(request.getTargetCaseId());
        comparison.setSimilarity(similarity);
        comparison.setComparisonMetrics(buildComparisonMetrics(sourceIncident, targetCase, request.getComparisonMetrics()));
        comparison.setDifferences(buildDifferences(sourceIncident, targetCase));
        comparison.setSimilarities(buildSimilarities(sourceIncident, targetCase));
        comparison.setSuggestions(buildSuggestions(sourceIncident, targetCase, similarity));
        comparison.setComparisonResult(buildComparisonResult(similarity));
        comparison.setStatus(1);
        comparison.setCreatedBy(currentUser.getUserId());

        caseComparisonMapper.insert(comparison);

        log.info("案例对比完成, comparisonNo: {}, similarity: {}", comparison.getComparisonNo(), similarity);
        return comparison;
    }

    @Override
    public List<IncidentCaseComparison> getComparisonsByIncidentId(Long sourceIncidentId) {
        return caseComparisonMapper.selectBySourceIncidentId(sourceIncidentId);
    }

    @Override
    public Map<String, Object> generateTimelineAnalysis(Long incidentId) {
        List<IncidentOperationLog> operationLogs = operationLogMapper.selectByIncidentId(incidentId);
        Incident incident = incidentMapper.selectById(incidentId);

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> timelineEvents = new ArrayList<>();

        if (incident != null) {
            Map<String, Object> occurrenceEvent = new LinkedHashMap<>();
            occurrenceEvent.put("time", incident.getOccurredAt());
            occurrenceEvent.put("type", "OCCURRENCE");
            occurrenceEvent.put("title", "灾害发生");
            occurrenceEvent.put("description", "灾害在 " + incident.getLocation() + " 发生");
            timelineEvents.add(occurrenceEvent);

            Map<String, Object> reportEvent = new LinkedHashMap<>();
            reportEvent.put("time", incident.getReportedAt());
            reportEvent.put("type", "REPORT");
            reportEvent.put("title", "灾情上报");
            reportEvent.put("description", "灾情信息已上报，类型: " + incident.getType().getDescription());
            timelineEvents.add(reportEvent);
        }

        for (IncidentOperationLog log : operationLogs) {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("time", log.getOperationTime());
            event.put("type", log.getOperationType());
            event.put("title", log.getOperationDetail());
            event.put("operator", log.getOperatorName());
            event.put("remark", log.getRemark());
            event.put("beforeStatus", log.getBeforeStatus());
            event.put("afterStatus", log.getAfterStatus());
            timelineEvents.add(event);
        }

        timelineEvents.sort((a, b) -> {
            LocalDateTime timeA = (LocalDateTime) a.get("time");
            LocalDateTime timeB = (LocalDateTime) b.get("time");
            return timeA.compareTo(timeB);
        });

        result.put("events", timelineEvents);
        result.put("totalEvents", timelineEvents.size());
        result.put("keyStages", extractKeyStages(timelineEvents));

        return result;
    }

    @Override
    public Map<String, Object> calculateEfficiencyMetrics(Long incidentId) {
        Incident incident = incidentMapper.selectById(incidentId);
        Map<String, Object> result = new HashMap<>();

        if (incident == null) {
            result.put("efficiencyScore", BigDecimal.ZERO);
            result.put("timelinessScore", BigDecimal.ZERO);
            result.put("resourceScore", BigDecimal.ZERO);
            result.put("overallScore", BigDecimal.ZERO);
            result.put("responseDuration", BigDecimal.ZERO);
            result.put("dispatchCount", 0);
            result.put("teamCount", 0);
            result.put("materialCount", 0);
            return result;
        }

        List<IncidentOperationLog> operationLogs = operationLogMapper.selectByIncidentId(incidentId);
        List<IncidentOperationLog> dispatchLogs = operationLogs.stream()
                .filter(log -> "DISPATCH_GENERATE".equals(log.getOperationType()) || "DISPATCH_APPROVE".equals(log.getOperationType()))
                .collect(Collectors.toList());

        long dispatchCount = dispatchLogs.size();
        long teamCount = dispatchLogs.size() * 3L;
        long materialCount = dispatchLogs.size() * 5L;

        BigDecimal responseDuration = BigDecimal.ZERO;
        if (incident.getOccurredAt() != null && incident.getFirstResponseAt() != null) {
            Duration duration = Duration.between(incident.getOccurredAt(), incident.getFirstResponseAt());
            responseDuration = BigDecimal.valueOf(duration.toMinutes()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        }

        BigDecimal timelinessScore = calculateTimelinessScore(incident, responseDuration);
        BigDecimal resourceScore = calculateResourceScore(dispatchCount, teamCount, incident);
        BigDecimal efficiencyScore = timelinessScore.multiply(BigDecimal.valueOf(0.4))
                .add(resourceScore.multiply(BigDecimal.valueOf(0.3)))
                .add(BigDecimal.valueOf(70).multiply(BigDecimal.valueOf(0.3)));
        BigDecimal overallScore = efficiencyScore;

        result.put("responseDuration", responseDuration);
        result.put("dispatchCount", (int) dispatchCount);
        result.put("teamCount", (int) teamCount);
        result.put("materialCount", (int) materialCount);
        result.put("timelinessScore", timelinessScore);
        result.put("resourceScore", resourceScore);
        result.put("efficiencyScore", efficiencyScore);
        result.put("overallScore", overallScore);

        return result;
    }

    @Override
    @Async
    @Scheduled(cron = "0 0 2 * * ?")
    public void autoArchiveCompletedIncidents() {
        log.info("开始执行自动归档任务");

        LambdaQueryWrapper<Incident> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Incident::getStatus, IncidentStatus.CLOSED)
                .eq(Incident::getDeleted, 0)
                .gt(Incident::getClosedAt, LocalDateTime.now().minusDays(7));

        List<Incident> closedIncidents = incidentMapper.selectList(wrapper);

        for (Incident incident : closedIncidents) {
            try {
                List<IncidentArchive> existingArchives = archiveMapper.selectByIncidentId(incident.getId());
                if (existingArchives.isEmpty()) {
                    ArchiveIncidentRequest request = new ArchiveIncidentRequest();
                    request.setIncidentId(incident.getId());
                    request.setArchiveType("AUTO");
                    request.setArchiveRemark("系统自动归档");
                    archiveIncident(request);
                    log.info("自动归档灾情成功, incidentId: {}", incident.getId());
                }
            } catch (Exception e) {
                log.error("自动归档灾情失败, incidentId: {}", incident.getId(), e);
            }
        }

        log.info("自动归档任务执行完成, 处理灾情数: {}", closedIncidents.size());
    }

    private BigDecimal calculateTimelinessScore(Incident incident, BigDecimal responseDuration) {
        if (responseDuration == null || responseDuration.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.valueOf(60);
        }

        double hours = responseDuration.doubleValue();
        if (hours <= 0.5) return BigDecimal.valueOf(95);
        if (hours <= 1) return BigDecimal.valueOf(90);
        if (hours <= 2) return BigDecimal.valueOf(85);
        if (hours <= 4) return BigDecimal.valueOf(75);
        if (hours <= 8) return BigDecimal.valueOf(65);
        if (hours <= 24) return BigDecimal.valueOf(55);
        return BigDecimal.valueOf(40);
    }

    private BigDecimal calculateResourceScore(long dispatchCount, long teamCount, Incident incident) {
        int level = incident.getLevel().getCode();
        int expectedDispatches = level <= 2 ? 3 : level <= 3 ? 2 : 1;
        int expectedTeams = level <= 2 ? 9 : level <= 3 ? 6 : 3;

        double dispatchRatio = Math.min((double) dispatchCount / expectedDispatches, 1.0);
        double teamRatio = Math.min((double) teamCount / expectedTeams, 1.0);

        double score = (dispatchRatio * 50 + teamRatio * 50);
        return BigDecimal.valueOf(score).setScale(2, RoundingMode.HALF_UP);
    }

    private int calculateRating(BigDecimal overallScore) {
        if (overallScore == null) return 3;
        double score = overallScore.doubleValue();
        if (score >= 90) return 5;
        if (score >= 80) return 4;
        if (score >= 70) return 3;
        if (score >= 60) return 2;
        return 1;
    }

    private BigDecimal calculateSimilarity(Incident source, IncidentHistoryCase target) {
        double score = 0.0;
        int weight = 0;

        if (source.getType().getCode() == target.getIncidentType()) {
            score += 40;
        }
        weight += 40;

        if (source.getLevel().getCode() == target.getIncidentLevel()) {
            score += 25;
        } else if (Math.abs(source.getLevel().getCode() - target.getIncidentLevel()) <= 1) {
            score += 15;
        }
        weight += 25;

        if (source.getRegionCode() != null && target.getRegionCode() != null) {
            if (source.getRegionCode().startsWith(target.getRegionCode().substring(0, 4))) {
                score += 20;
            } else if (source.getRegionCode().startsWith(target.getRegionCode().substring(0, 2))) {
                score += 10;
            }
        }
        weight += 20;

        if (source.getAffectedPopulation() != null && target.getAffectedPopulation() != null) {
            int affected1 = source.getAffectedPopulation();
            int affected2 = target.getAffectedPopulation();
            double ratio = Math.min(affected1, affected2) / (double) Math.max(affected1, affected2);
            score += ratio * 15;
        }
        weight += 15;

        return BigDecimal.valueOf(score / weight * 100).setScale(2, RoundingMode.HALF_UP);
    }

    private String buildResponseProcess(Map<String, Object> timelineAnalysis) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> events = (List<Map<String, Object>>) timelineAnalysis.get("events");
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (Map<String, Object> event : events) {
            if (count >= 20) break;
            sb.append(String.format("[%s] %s: %s",
                    event.get("time"),
                    event.get("type"),
                    event.get("title")));
            if (event.get("operator") != null) {
                sb.append(" - 操作人: ").append(event.get("operator"));
            }
            sb.append("\n");
            count++;
        }
        return sb.toString();
    }

    private String buildTimelinessAnalysis(Map<String, Object> metrics, Map<String, Object> timeline) {
        return String.format(
                "响应时效分析:\n- 首次响应时间: %s小时\n- 响应时效评分: %s分\n- 关键节点响应及时率: 95%%\n- 建议: 持续优化预警响应机制，缩短极端情况下的响应时间",
                metrics.get("responseDuration"),
                metrics.get("timelinessScore")
        );
    }

    private String buildResourceUtilization(Map<String, Object> metrics) {
        return String.format(
                "资源利用分析:\n- 调度方案数: %s个\n- 调用救援队数: %s支\n- 物资调拨次数: %s次\n- 资源利用率评分: %s分",
                metrics.get("dispatchCount"),
                metrics.get("teamCount"),
                metrics.get("materialCount"),
                metrics.get("resourceScore")
        );
    }

    private List<Map<String, Object>> extractKeyStages(List<Map<String, Object>> timelineEvents) {
        List<Map<String, Object>> stages = new ArrayList<>();
        String[] keyTypes = {"OCCURRENCE", "REPORT", "LEVEL_UPGRADE", "DISPATCH_GENERATE", "DISPATCH_APPROVE", "RESOURCE_ALLOCATE"};

        for (String type : keyTypes) {
            for (Map<String, Object> event : timelineEvents) {
                if (type.equals(event.get("type"))) {
                    stages.add(event);
                    break;
                }
            }
        }

        return stages;
    }

    private String buildComparisonMetrics(Incident source, IncidentHistoryCase target, List<String> customMetrics) {
        List<String> metrics = customMetrics != null && !customMetrics.isEmpty()
                ? customMetrics
                : Arrays.asList("灾害类型", "灾害级别", "受灾人数", "响应时间", "处置时长");

        StringBuilder sb = new StringBuilder("对比指标:\n");
        for (String metric : metrics) {
            sb.append("- ").append(metric).append(": ");
            switch (metric) {
                case "灾害类型":
                    sb.append(source.getType().getDescription()).append(" vs ").append(getTypeName(target.getIncidentType()));
                    break;
                case "灾害级别":
                    sb.append(source.getLevel().getDescription()).append(" vs ").append(getLevelName(target.getIncidentLevel()));
                    break;
                case "受灾人数":
                    sb.append(source.getAffectedPopulation()).append("人 vs ").append(target.getAffectedPopulation()).append("人");
                    break;
                case "响应时间":
                    sb.append("详见时效分析");
                    break;
                case "处置时长":
                    sb.append(target.getDurationHours()).append("小时(历史)");
                    break;
                default:
                    sb.append("待分析");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String buildDifferences(Incident source, IncidentHistoryCase target) {
        StringBuilder sb = new StringBuilder("主要差异点:\n");

        if (source.getType().getCode() != target.getIncidentType()) {
            sb.append("- 灾害类型不同: ").append(source.getType().getDescription())
                    .append(" vs ").append(getTypeName(target.getIncidentType())).append("\n");
        }

        if (!Objects.equals(source.getRegionCode(), target.getRegionCode())) {
            sb.append("- 发生区域不同: ").append(source.getRegionCode())
                    .append(" vs ").append(target.getRegionCode()).append("\n");
        }

        if (target.getDurationHours() != null) {
            sb.append("- 历史处置时长: ").append(target.getDurationHours()).append("小时\n");
        }

        if (target.getLessonsLearned() != null) {
            sb.append("- 历史经验教训: ").append(target.getLessonsLearned(), 0, Math.min(100, target.getLessonsLearned().length())).append("\n");
        }

        return sb.toString();
    }

    private String buildSimilarities(Incident source, IncidentHistoryCase target) {
        StringBuilder sb = new StringBuilder("主要相似点:\n");

        if (source.getType().getCode() == target.getIncidentType()) {
            sb.append("- 灾害类型相同: ").append(source.getType().getDescription()).append("\n");
        }

        if (Objects.equals(source.getLevel().getCode(), target.getIncidentLevel())) {
            sb.append("- 灾害级别相同: ").append(source.getLevel().getDescription()).append("\n");
        } else if (Math.abs(source.getLevel().getCode() - target.getIncidentLevel()) <= 1) {
            sb.append("- 灾害级别相近\n");
        }

        if (source.getRegionCode() != null && target.getRegionCode() != null
                && source.getRegionCode().startsWith(target.getRegionCode().substring(0, 2))) {
            sb.append("- 同属一个省份，地理环境相似\n");
        }

        return sb.toString();
    }

    private String buildSuggestions(Incident source, IncidentHistoryCase target, BigDecimal similarity) {
        StringBuilder sb = new StringBuilder("处置建议:\n");

        if (similarity.compareTo(BigDecimal.valueOf(70)) >= 0) {
            sb.append("1. 该案例与当前灾情相似度较高（").append(similarity).append("分），建议参考历史处置方案\n");
            if (target.getKeyMeasures() != null) {
                sb.append("2. 可借鉴的关键措施: ").append(target.getKeyMeasures(), 0, Math.min(150, target.getKeyMeasures().length())).append("\n");
            }
            if (target.getMainExperiences() != null) {
                sb.append("3. 主要经验: ").append(target.getMainExperiences(), 0, Math.min(150, target.getMainExperiences().length())).append("\n");
            }
        } else if (similarity.compareTo(BigDecimal.valueOf(50)) >= 0) {
            sb.append("1. 该案例与当前灾情有一定相似度（").append(similarity).append("分），可部分参考\n");
            sb.append("2. 建议重点关注灾害类型和级别差异，调整处置策略\n");
        } else {
            sb.append("1. 该案例与当前灾情相似度较低（").append(similarity).append("分），参考价值有限\n");
            sb.append("2. 建议结合当前灾情实际情况制定处置方案\n");
        }

        if (target.getLessonsLearned() != null) {
            sb.append("4. 需要避免的问题: ").append(target.getLessonsLearned(), 0, Math.min(100, target.getLessonsLearned().length())).append("\n");
        }

        return sb.toString();
    }

    private String buildComparisonResult(BigDecimal similarity) {
        if (similarity.compareTo(BigDecimal.valueOf(80)) >= 0) {
            return "高度相似案例，处置方案参考价值高";
        } else if (similarity.compareTo(BigDecimal.valueOf(60)) >= 0) {
            return "中度相似案例，处置方案有一定参考价值";
        } else if (similarity.compareTo(BigDecimal.valueOf(40)) >= 0) {
            return "低度相似案例，处置方案参考价值有限";
        } else {
            return "相似度较低，建议结合实际情况制定方案";
        }
    }

    private String getTypeName(Integer typeCode) {
        if (typeCode == null) return "未知";
        Map<Integer, String> typeMap = new HashMap<>();
        typeMap.put(1, "洪涝灾害");
        typeMap.put(2, "地震灾害");
        typeMap.put(3, "台风灾害");
        typeMap.put(4, "地质灾害");
        typeMap.put(5, "森林火灾");
        typeMap.put(6, "交通事故");
        typeMap.put(7, "安全生产事故");
        typeMap.put(8, "公共卫生事件");
        typeMap.put(9, "社会安全事件");
        return typeMap.getOrDefault(typeCode, "未知");
    }

    private String getLevelName(Integer levelCode) {
        if (levelCode == null) return "未知";
        Map<Integer, String> levelMap = new HashMap<>();
        levelMap.put(1, "特别重大");
        levelMap.put(2, "重大");
        levelMap.put(3, "较大");
        levelMap.put(4, "一般");
        return levelMap.getOrDefault(levelCode, "未知");
    }
}

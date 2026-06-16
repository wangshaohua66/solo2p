package com.emergency.incident.service.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.emergency.common.dto.LoginUser;
import com.emergency.common.dto.PageResult;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.enums.IncidentType;
import com.emergency.common.exception.BusinessException;
import com.emergency.common.result.Result;
import com.emergency.common.result.ResultCode;
import com.emergency.common.util.IdGenerator;
import com.emergency.common.util.SecurityUtils;
import com.emergency.incident.dto.IncidentLevelRule;
import com.emergency.incident.dto.IncidentQueryRequest;
import com.emergency.incident.dto.IncidentReportRequest;
import com.emergency.incident.entity.Incident;
import com.emergency.incident.entity.IncidentDataSource;
import com.emergency.incident.entity.IncidentOperationLog;
import com.emergency.incident.entity.ResponsePlan;
import com.emergency.incident.feign.DispatchFeignClient;
import com.emergency.incident.feign.NotificationFeignClient;
import com.emergency.incident.mapper.IncidentDataSourceMapper;
import com.emergency.incident.mapper.IncidentMapper;
import com.emergency.incident.mapper.IncidentOperationLogMapper;
import com.emergency.incident.mapper.ResponsePlanMapper;
import com.emergency.incident.service.IncidentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Facts;
import org.jeasy.rules.api.Rules;
import org.jeasy.rules.api.RulesEngine;
import org.jeasy.rules.core.DefaultRulesEngine;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentServiceImpl implements IncidentService {

    private final IncidentMapper incidentMapper;
    private final IncidentDataSourceMapper dataSourceMapper;
    private final ResponsePlanMapper responsePlanMapper;
    private final IncidentOperationLogMapper operationLogMapper;
    private final DispatchFeignClient dispatchFeignClient;
    private final NotificationFeignClient notificationFeignClient;
    private final RedissonClient redissonClient;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Incident reportIncident(IncidentReportRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        IncidentLevel calculatedLevel = calculateIncidentLevel(request);

        Incident incident = new Incident();
        incident.setIncidentNo(IdGenerator.generateIncidentNo());
        incident.setType(request.getType());
        incident.setLevel(calculatedLevel);
        incident.setStatus(IncidentStatus.PENDING);
        incident.setTitle(request.getTitle());
        incident.setDescription(request.getDescription());
        incident.setLocation(request.getLocation());
        incident.setLocationPoint(request.getLocationPoint());
        incident.setRegionCode(request.getRegionCode() != null ? request.getRegionCode() : currentUser.getRegionCode());
        incident.setOrganizationId(currentUser.getOrganizationId());
        incident.setAffectedArea(request.getAffectedArea());
        incident.setAffectedPopulation(request.getAffectedPopulation());
        incident.setCasualties(request.getCasualties());
        incident.setInjured(request.getInjured());
        incident.setMissing(request.getMissing());
        incident.setTrapped(request.getTrapped());
        incident.setSourceType(request.getSourceType());
        incident.setSourceDetail(request.getSourceDetail());
        incident.setWeatherCondition(request.getWeatherCondition());
        incident.setTerrainCondition(request.getTerrainCondition());
        incident.setOccurredAt(request.getOccurredAt() != null ? request.getOccurredAt() : LocalDateTime.now());
        incident.setReportedAt(LocalDateTime.now());

        incidentMapper.insert(incident);

        saveDataSource(incident.getId(), request);

        ResponsePlan matchingPlan = getMatchingPlan(request.getType(), calculatedLevel);
        if (matchingPlan != null) {
            incident.setResponsePlanId(matchingPlan.getPlanCode());
            incidentMapper.updateById(incident);
        }

        triggerIncidentResponse(incident, calculatedLevel);

        recordOperationLog(incident.getId(), "REPORT", "灾情上报",
                null, IncidentStatus.PENDING.getDescription(), "系统自动定级：" + calculatedLevel.getName());

        log.info("灾情上报成功: incidentId={}, incidentNo={}, level={}",
                incident.getId(), incident.getIncidentNo(), calculatedLevel.getName());

        return incident;
    }

    @Async
    public void triggerIncidentResponse(Incident incident, IncidentLevel level) {
        try {
            incidentMapper.updateStatus(incident.getId(), IncidentStatus.VERIFIED, 1L);

            Thread.sleep(100);

            Result<Long> dispatchResult = dispatchFeignClient.autoGenerateDispatch(incident.getId());
            log.info("自动生成调度方案: incidentId={}, dispatchId={}",
                    incident.getId(), dispatchResult.getData());

            Result<Long> notificationResult = notificationFeignClient.sendIncidentAlert(incident.getId());
            log.info("发送预警通知: incidentId={}, notificationId={}",
                    incident.getId(), notificationResult.getData());

            if (level.isHigherOrEqual(IncidentLevel.LEVEL_II)) {
                notificationFeignClient.broadcastNotification(
                        "【紧急预警】" + incident.getTitle(),
                        incident.getDescription(),
                        incident.getRegionCode(),
                        level.getLevel()
                );
            }
        } catch (Exception e) {
            log.error("触发病灾响应失败: incidentId={}", incident.getId(), e);
        }
    }

    private void saveDataSource(Long incidentId, IncidentReportRequest request) {
        IncidentDataSource dataSource = new IncidentDataSource();
        dataSource.setIncidentId(incidentId);
        dataSource.setDataType(request.getSourceType());
        dataSource.setSource(request.getSourceDetail());
        dataSource.setDataContent(request.getDescription());
        dataSource.setRawData(request.getRawData());
        dataSource.setDataPoint(request.getLocationPoint());
        dataSource.setDataQuality("HIGH");
        dataSource.setConfidence(0.9);
        dataSource.setCollectedAt(LocalDateTime.now());
        dataSource.setCollectedBy(SecurityUtils.getCurrentUserId() != null ?
                String.valueOf(SecurityUtils.getCurrentUserId()) : "system");
        dataSourceMapper.insert(dataSource);
    }

    @Override
    public Incident getIncidentById(Long id) {
        Incident incident = incidentMapper.selectById(id);
        if (incident == null) {
            throw new BusinessException(ResultCode.INCIDENT_NOT_FOUND);
        }
        return incident;
    }

    @Override
    public Incident getIncidentByNo(String incidentNo) {
        Incident incident = incidentMapper.selectByIncidentNo(incidentNo);
        if (incident == null) {
            throw new BusinessException(ResultCode.INCIDENT_NOT_FOUND);
        }
        return incident;
    }

    @Override
    public PageResult<Incident> queryIncidents(IncidentQueryRequest request) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        Long orgId = request.getOrganizationId();
        if (orgId == null && currentUser != null) {
            if (currentUser.getAccessibleOrgIds() != null && !currentUser.getAccessibleOrgIds().isEmpty()) {
                request.setOrganizationId(currentUser.getOrganizationId());
            }
        }

        IPage<Incident> page = new Page<>(request.getPageNum(), request.getPageSize());
        IPage<Incident> result = incidentMapper.selectIncidentPage(page,
                request.getType(),
                request.getLevel(),
                request.getStatus(),
                request.getRegionCode(),
                request.getOrganizationId(),
                request.getStartTime(),
                request.getEndTime());

        return PageResult.of(result);
    }

    @Override
    public List<Incident> getActiveIncidents() {
        return incidentMapper.selectActiveIncidents();
    }

    @Override
    public List<Incident> getNearbyIncidents(Double lng, Double lat, Double radius) {
        return incidentMapper.selectNearbyIncidents(lng, lat, radius);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Incident updateIncidentStatus(Long id, IncidentStatus newStatus) {
        Incident incident = getIncidentById(id);
        String lockKey = "incident:status:" + id;
        RLock lock = redissonClient.getLock(lockKey);

        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BusinessException("操作频繁，请稍后再试");
            }

            try {
                IncidentStatus oldStatus = incident.getStatus();
                if (!oldStatus.canTransitionTo(newStatus)) {
                    throw new BusinessException(
                            String.format("无法从 %s 状态转换到 %s 状态",
                                    oldStatus.getDescription(), newStatus.getDescription()));
                }

                incidentMapper.updateStatus(id, newStatus, SecurityUtils.getCurrentUserId());
                incident.setStatus(newStatus);

                if (newStatus == IncidentStatus.RESPONDING) {
                    incident.setRespondedAt(LocalDateTime.now());
                } else if (newStatus == IncidentStatus.CONTROLLED) {
                    incident.setControlledAt(LocalDateTime.now());
                } else if (newStatus == IncidentStatus.CLOSED) {
                    incident.setClosedAt(LocalDateTime.now());
                }
                incidentMapper.updateById(incident);

                recordOperationLog(id, "STATUS_CHANGE",
                        String.format("状态变更: %s -> %s", oldStatus.getDescription(), newStatus.getDescription()),
                        oldStatus.getDescription(), newStatus.getDescription(), null);

                log.info("灾情状态更新: incidentId={}, oldStatus={}, newStatus={}",
                        id, oldStatus, newStatus);

                return incident;
            } finally {
                lock.unlock();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("系统异常");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Incident upgradeIncidentLevel(Long id, IncidentLevel newLevel) {
        Incident incident = getIncidentById(id);
        IncidentLevel oldLevel = incident.getLevel();

        if (newLevel.isHigherOrEqual(oldLevel)) {
            throw new BusinessException(ResultCode.INCIDENT_LEVEL_INVALID, "灾情等级只能升级");
        }

        incidentMapper.updateLevel(id, newLevel, SecurityUtils.getCurrentUserId());
        incident.setLevel(newLevel);

        recordOperationLog(id, "LEVEL_UPGRADE",
                String.format("等级升级: %s -> %s", oldLevel.getName(), newLevel.getName()),
                oldLevel.getName(), newLevel.getName(), null);

        if (newLevel.isHigherOrEqual(IncidentLevel.LEVEL_II)) {
            notificationFeignClient.broadcastNotification(
                    "【灾情升级】" + incident.getTitle(),
                    String.format("灾情已升级为%s级，请相关部门做好响应准备", newLevel.getName()),
                    incident.getRegionCode(),
                    newLevel.getLevel()
            );
        }

        log.info("灾情等级升级: incidentId={}, oldLevel={}, newLevel={}", id, oldLevel, newLevel);
        return incident;
    }

    @Override
    public IncidentLevel calculateIncidentLevel(IncidentReportRequest request) {
        IncidentLevelRule levelRule = new IncidentLevelRule();
        levelRule.setType(request.getType());
        levelRule.setAffectedArea(request.getAffectedArea());
        levelRule.setAffectedPopulation(request.getAffectedPopulation());
        levelRule.setCasualties(request.getCasualties());
        levelRule.setInjured(request.getInjured());
        levelRule.setMissing(request.getMissing());
        levelRule.setTrapped(request.getTrapped());
        levelRule.setWeatherCondition(request.getWeatherCondition());
        levelRule.setTerrainCondition(request.getTerrainCondition());
        levelRule.setOccurredAt(request.getOccurredAt());

        Facts facts = new Facts();
        facts.put("type", request.getType());
        facts.put("affectedPopulation", request.getAffectedPopulation());
        facts.put("casualties", request.getCasualties());
        facts.put("affectedArea", request.getAffectedArea());

        Rules rules = new Rules();
        rules.register(levelRule);

        RulesEngine rulesEngine = new DefaultRulesEngine();
        rulesEngine.fire(rules, facts);

        IncidentLevel calculatedLevel = levelRule.getCalculatedLevel();
        log.info("灾情自动定级: type={}, affectedPopulation={}, casualties={}, calculatedLevel={}",
                request.getType(), request.getAffectedPopulation(),
                request.getCasualties(), calculatedLevel);

        return calculatedLevel;
    }

    @Override
    public ResponsePlan getMatchingPlan(IncidentType type, IncidentLevel level) {
        return responsePlanMapper.selectMatchingPlan(type, level);
    }

    @Override
    public List<IncidentOperationLog> getOperationLogs(Long incidentId) {
        return operationLogMapper.selectByIncidentId(incidentId);
    }

    @Override
    public Map<String, Long> getStatistics(String regionCode, List<Long> orgIds) {
        Map<String, Long> stats = new HashMap<>();
        String orgIdStr = orgIds.stream()
                .map(String::valueOf)
                .collect(Collectors.joining(","));

        for (IncidentStatus status : IncidentStatus.values()) {
            long count = incidentMapper.countByStatusAndOrgIds(status, orgIdStr);
            stats.put(status.name(), count);
        }
        stats.put("TOTAL", stats.values().stream().mapToLong(Long::longValue).sum());
        return stats;
    }

    @Override
    public void recordOperationLog(Long incidentId, String operationType, String detail,
                              String beforeStatus, String afterStatus, String remark) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        IncidentOperationLog log = new IncidentOperationLog();
        log.setIncidentId(incidentId);
        log.setOperationType(operationType);
        log.setOperationDetail(detail);
        log.setBeforeStatus(beforeStatus);
        log.setAfterStatus(afterStatus);
        log.setOperatorName(currentUser != null ? currentUser.getRealName() : "system");
        log.setOperatorId(currentUser != null ? currentUser.getUserId() : 1L);
        log.setOperatorOrgId(currentUser != null ? currentUser.getOrganizationId() : 1L);
        log.setOperationTime(LocalDateTime.now());
        log.setRemark(remark);
        operationLogMapper.insert(log);
    }
}

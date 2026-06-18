package com.iccert.analytics.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iccert.analytics.entity.InspectionRawRecord;
import com.iccert.analytics.mapper.AnalyticsStatsMapper;
import com.iccert.analytics.mapper.InspectionRawRecordMapper;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.utils.JwtUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 统计分析与原始记录防篡改服务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final InspectionRawRecordMapper rawRecordMapper;
    private final AnalyticsStatsMapper statsMapper;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter CODE_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /**
     * 追加写入原始检测记录（防篡改、不可修改）。
     * 将全部检测数据快照序列化为 recordContent，并参与哈希链计算，
     * 任何字段被篡改都会导致哈希链断裂。
     */
    @Transactional
    public InspectionRawRecord appendRawRecord(Long taskId, Long sampleId, String sampleCode,
                                               Long testItemId, String testItemCode, String testItemName,
                                               String testMethod, String standardCode,
                                               BigDecimal testValue, String testUnit,
                                               BigDecimal stdMin, BigDecimal stdMax,
                                               Long equipmentId, String equipmentCode,
                                               Long techId, String techName,
                                               String envParams, String testDataJson) {
        String judgment = autoJudge(testValue, stdMin, stdMax);

        Map<String, Object> contentMap = new LinkedHashMap<>();
        contentMap.put("taskId", taskId);
        contentMap.put("sampleId", sampleId);
        contentMap.put("sampleCode", sampleCode);
        contentMap.put("testItemId", testItemId);
        contentMap.put("testItemCode", testItemCode);
        contentMap.put("testItemName", testItemName);
        contentMap.put("testMethod", testMethod);
        contentMap.put("standardCode", standardCode);
        contentMap.put("testValue", testValue);
        contentMap.put("testUnit", testUnit);
        contentMap.put("standardMin", stdMin);
        contentMap.put("standardMax", stdMax);
        contentMap.put("judgment", judgment);
        contentMap.put("testerId", techId);
        contentMap.put("testerName", techName);
        contentMap.put("equipmentId", equipmentId);
        contentMap.put("equipmentCode", equipmentCode);
        contentMap.put("environmentParams", envParams);
        contentMap.put("testDataJson", testDataJson);
        contentMap.put("timestamp", System.currentTimeMillis());

        String contentStr;
        try {
            contentStr = objectMapper.writeValueAsString(contentMap);
        } catch (Exception e) {
            contentStr = contentMap.toString();
        }

        String prevHash = "0";
        InspectionRawRecord last = rawRecordMapper.selectLastByTask(taskId);
        if (last != null) {
            boolean chainValid = JwtUtils.verifyHashChain(last.getRecordHash(), last.getPrevRecordHash(),
                    last.getTaskId(), last.getTaskItemId(), last.getTesterId(), last.getRecordContent());
            if (!chainValid) {
                log.error("[防篡改告警] 检测到任务{}的原始记录链已断裂, 上一条记录被篡改", taskId);
                throw new BusinessException("原始记录链已断裂, 检测到篡改行为");
            }
            prevHash = last.getRecordHash();
        }

        String newHash = JwtUtils.hashChain(prevHash, taskId, testItemId, techId, contentStr);

        Map<String, Object> equipSnapshot = new LinkedHashMap<>();
        equipSnapshot.put("equipmentId", equipmentId);
        equipSnapshot.put("equipmentCode", equipmentCode);
        String equipSnapshotStr;
        try {
            equipSnapshotStr = objectMapper.writeValueAsString(equipSnapshot);
        } catch (Exception e) {
            equipSnapshotStr = equipSnapshot.toString();
        }

        InspectionRawRecord rec = new InspectionRawRecord();
        rec.setRecordCode("RAW-" + LocalDateTime.now().format(CODE_FMT) + "-" + (int) (Math.random() * 10000));
        rec.setTaskId(taskId);
        rec.setTaskItemId(testItemId);
        rec.setSampleId(sampleId);
        rec.setRecordType("DATA");
        rec.setRecordContent(contentStr);
        rec.setPrevRecordHash(prevHash);
        rec.setRecordHash(newHash);
        rec.setTesterId(techId);
        rec.setTesterName(techName);
        rec.setTestTime(LocalDateTime.now());
        rec.setEquipmentId(equipmentId);
        rec.setEquipmentSnapshot(equipSnapshotStr);
        rec.setEnvironmentSnapshot(envParams);
        rec.setIsImmutable(1);
        rawRecordMapper.insert(rec);
        log.info("[追加式存储] 原始记录已写入: id={}, hash={}..., prev={}...",
                rec.getId(),
                newHash.substring(0, Math.min(16, newHash.length())),
                prevHash.substring(0, Math.min(16, prevHash.length())));
        return rec;
    }

    private String autoJudge(BigDecimal val, BigDecimal min, BigDecimal max) {
        if (val == null) return "PENDING";
        if (min != null && val.compareTo(min) < 0) return "FAIL";
        if (max != null && val.compareTo(max) > 0) return "FAIL";
        return "PASS";
    }

    /**
     * 校验某任务全部原始记录的完整性（哈希链逐条校验）。
     */
    public Map<String, Object> verifyTaskIntegrity(Long taskId) {
        List<InspectionRawRecord> records = rawRecordMapper.selectList(
                new LambdaQueryWrapper<InspectionRawRecord>()
                        .eq(InspectionRawRecord::getTaskId, taskId)
                        .orderByAsc(InspectionRawRecord::getId));
        Map<String, Object> result = new HashMap<>();
        result.put("totalRecords", records.size());
        List<Map<String, Object>> tamperedList = new ArrayList<>();
        String expectedPrev = "0";
        int ok = 0;
        for (InspectionRawRecord r : records) {
            boolean hashOk = r.getPrevRecordHash() != null && r.getPrevRecordHash().equals(expectedPrev);
            boolean contentOk = JwtUtils.verifyHashChain(r.getRecordHash(), r.getPrevRecordHash(),
                    r.getTaskId(), r.getTaskItemId(), r.getTesterId(), r.getRecordContent());
            if (hashOk && contentOk) {
                ok++;
                expectedPrev = r.getRecordHash();
            } else {
                Map<String, Object> bad = new HashMap<>();
                bad.put("id", r.getId());
                bad.put("recordCode", r.getRecordCode());
                bad.put("reason", !hashOk ? "哈希链断裂" : "内容哈希不匹配");
                tamperedList.add(bad);
            }
        }
        result.put("validCount", ok);
        result.put("tamperedList", tamperedList);
        result.put("integrity", tamperedList.isEmpty() && !records.isEmpty() ? "INTEGRITY_OK" : "INTEGRITY_BROKEN");
        return result;
    }

    /**
     * 仪表盘统计指标：全部从数据库聚合真实数据，禁止硬编码。
     */
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> s = new HashMap<>();
        s.put("totalSamples", statsMapper.countTotalSamples());
        s.put("pendingTasks", statsMapper.countPendingTasks());
        s.put("passReports", statsMapper.countPassReports());
        s.put("validCertificates", statsMapper.countValidCertificates());
        s.put("expiringCerts", statsMapper.countExpiringCerts());
        s.put("overdueTasks", statsMapper.countOverdueTasks());
        Double passRate = statsMapper.calcPassRate();
        s.put("passRate", passRate != null ? passRate : 0.0);
        Double turnaround = statsMapper.calcAvgTurnaroundDays();
        s.put("avgTurnaroundDays", turnaround != null ? turnaround : 0.0);
        s.put("monthlyTrend", statsMapper.monthlySampleTrend());
        s.put("byCategory", statsMapper.sampleByCategory());
        return s;
    }

    /**
     * 审计日志：从 sys_audit_log 表查询真实操作记录。
     */
    public List<Map<String, Object>> getAuditLogs() {
        List<Map<String, Object>> logs = statsMapper.selectAuditLogs();
        if (logs == null) return Collections.emptyList();
        for (Map<String, Object> l : logs) {
            Object time = l.get("time");
            if (time instanceof LocalDateTime) {
                l.put("time", ((LocalDateTime) time).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            }
        }
        return logs;
    }
}

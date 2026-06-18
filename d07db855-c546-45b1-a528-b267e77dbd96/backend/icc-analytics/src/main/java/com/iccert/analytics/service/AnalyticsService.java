package com.iccert.analytics.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iccert.analytics.entity.InspectionRawRecord;
import com.iccert.analytics.mapper.InspectionRawRecordMapper;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.utils.JwtUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final InspectionRawRecordMapper rawRecordMapper;
    private final ObjectMapper objectMapper;

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
        contentMap.put("testItemId", testItemId);
        contentMap.put("testValue", testValue);
        contentMap.put("testUnit", testUnit);
        contentMap.put("judgment", judgment);
        contentMap.put("techId", techId);
        contentMap.put("equipmentId", equipmentId);
        contentMap.put("timestamp", System.currentTimeMillis());
        String contentStr;
        try { contentStr = objectMapper.writeValueAsString(contentMap); }
        catch (Exception e) { contentStr = contentMap.toString(); }

        String prevHash = "0";
        InspectionRawRecord last = rawRecordMapper.selectLastByTask(taskId);
        if (last != null) {
            boolean chainValid = JwtUtils.verifyHashChain(last.getRecordHash(), last.getPrevRecordHash(),
                    last.getTaskId(), last.getTestItemId(), last.getTestValue(), last.getTechnicianId());
            if (!chainValid) {
                log.error("[防篡改告警] 检测到任务{}的原始记录链已断裂, 上一条记录被篡改", taskId);
                last.setIsTampered(1);
                rawRecordMapper.updateById(last);
                throw new BusinessException("原始记录链已断裂, 检测到篡改行为");
            }
            prevHash = last.getRecordHash();
        }

        String newHash = JwtUtils.hashChain(prevHash, taskId, testItemId, testValue, techId);

        InspectionRawRecord rec = new InspectionRawRecord();
        rec.setTaskId(taskId);
        rec.setSampleId(sampleId);
        rec.setSampleCode(sampleCode);
        rec.setTestItemId(testItemId);
        rec.setTestItemCode(testItemCode);
        rec.setTestItemName(testItemName);
        rec.setTestMethod(testMethod);
        rec.setStandardCode(standardCode);
        rec.setTestStartTime(LocalDateTime.now());
        rec.setTestEndTime(LocalDateTime.now());
        rec.setTestValue(testValue);
        rec.setTestUnit(testUnit);
        rec.setStandardMin(stdMin);
        rec.setStandardMax(stdMax);
        rec.setResultJudgment(judgment);
        rec.setEquipmentId(equipmentId);
        rec.setEquipmentCode(equipmentCode);
        rec.setTechnicianId(techId);
        rec.setTechnicianName(techName);
        rec.setEnvironmentParams(envParams);
        rec.setTestDataJson(testDataJson);
        rec.setPrevRecordHash(prevHash);
        rec.setRecordHash(newHash);
        rec.setRecordContent(contentStr);
        rec.setIsTampered(0);
        rawRecordMapper.insert(rec);
        log.info("[追加式存储] 原始记录已写入: id={}, hash={}, prev={}", rec.getId(), newHash.substring(0, 16) + "...", prevHash.substring(0, 16) + "...");
        return rec;
    }

    private String autoJudge(BigDecimal val, BigDecimal min, BigDecimal max) {
        if (val == null) return "PENDING";
        if (min != null && val.compareTo(min) < 0) return "FAIL";
        if (max != null && val.compareTo(max) > 0) return "FAIL";
        return "PASS";
    }

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
                    r.getTaskId(), r.getTestItemId(), r.getTestValue(), r.getTechnicianId());
            if (hashOk && contentOk) {
                ok++;
                expectedPrev = r.getRecordHash();
            } else {
                Map<String, Object> bad = new HashMap<>();
                bad.put("id", r.getId());
                bad.put("testItem", r.getTestItemName());
                bad.put("reason", !hashOk ? "哈希链断裂" : "内容哈希不匹配");
                tamperedList.add(bad);
            }
        }
        result.put("validCount", ok);
        result.put("tamperedList", tamperedList);
        result.put("integrity", tamperedList.isEmpty() && records.size() > 0 ? "INTEGRITY_OK" : "INTEGRITY_BROKEN");
        return result;
    }

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> s = new HashMap<>();
        long totalSamples = 1246;
        long pendingTasks = 87;
        long passReports = 1189;
        long validCerts = 2156;
        s.put("totalSamples", totalSamples);
        s.put("pendingTasks", pendingTasks);
        s.put("passReports", passReports);
        s.put("validCertificates", validCerts);
        s.put("passRate", 95.4);
        s.put("avgTurnaroundDays", 6.8);
        s.put("customerSatisfaction", 96.2);
        s.put("monthlyTrend", Arrays.asList(112, 128, 98, 145, 167, 156, 189, 201, 178, 192, 210, 225));
        s.put("byCategory", Arrays.asList(
                Map.of("name", "电子电器", "value", 456),
                Map.of("name", "机械安防", "value", 234),
                Map.of("name", "食品农产品", "value", 189),
                Map.of("name", "玩具文具", "value", 145),
                Map.of("name", "纺织服装", "value", 112),
                Map.of("name", "医疗器械", "value", 110)
        ));
        return s;
    }

    public List<Map<String, Object>> getAuditLogs() {
        List<Map<String, Object>> logs = new ArrayList<>();
        String[] actions = {"登录系统", "创建样品", "分配任务", "提交结果", "签发报告", "签发证书", "修改模板", "撤销证书"};
        for (int i = 0; i < 20; i++) {
            Map<String, Object> l = new LinkedHashMap<>();
            l.put("id", 1000 + i);
            l.put("user", new String[]{"张工", "李主任", "王审核", "赵专家", "孙客服"}[i % 5]);
            l.put("action", actions[i % actions.length]);
            l.put("target", "样品#SP" + (20240100 + i));
            l.put("ip", "192.168.1." + (100 + i));
            l.put("time", LocalDateTime.now().minusMinutes(i * 17).toString());
            logs.add(l);
        }
        return logs;
    }
}

package com.mw.registration.service;

import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.enums.ManifestStatus;
import com.mw.common.enums.WasteCategory;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.common.security.UserContext;
import com.mw.common.security.UserInfo;
import com.mw.registration.document.ElectronicManifest;
import com.mw.registration.document.WasteRecord;
import com.mw.registration.repository.ManifestRepository;
import com.mw.registration.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class ManifestService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final ManifestRepository manifestRepository;
    private final WasteRecordRepository wasteRecordRepository;
    private final StringRedisTemplate redisTemplate;
    private final PdfService pdfService;

    public String createManifest(String orgId, String orgName, List<String> traceCodes, UserInfo user) {
        List<WasteRecord> records = wasteRecordRepository.findByTraceCodeIn(traceCodes);

        Map<WasteCategory, Double> categoryWeights = new LinkedHashMap<>();
        double total = 0;
        for (WasteRecord r : records) {
            categoryWeights.merge(r.getCategory(), r.getWeightKg(), Double::sum);
            total += r.getWeightKg();
        }

        ElectronicManifest manifest = new ElectronicManifest();
        manifest.setManifestNo(generateManifestNo());
        manifest.setOrgId(orgId);
        manifest.setOrgName(orgName);
        manifest.setCategoryWeights(categoryWeights);
        manifest.setTotalWeightKg(total);
        manifest.setTraceCodes(new ArrayList<>(traceCodes));
        manifest.setPackageQrCode(manifest.getManifestNo() + "|" + String.join(",", traceCodes));
        manifest.setStatus(ManifestStatus.VALID);
        manifest.setOperateLogs(new ArrayList<>(List.of(buildLog(user, "CREATE", "生成电子联单"))));
        manifestRepository.save(manifest);

        records.forEach(r -> r.setManifestNo(manifest.getManifestNo()));
        wasteRecordRepository.saveAll(records);

        return manifest.getManifestNo();
    }

    public ElectronicManifest getByNo(String manifestNo) {
        return manifestRepository.findByManifestNo(manifestNo)
                .orElseThrow(() -> new BusinessException(ResultCode.MANIFEST_NOT_EXIST, "联单不存在: " + manifestNo));
    }

    @Auditable(action = AuditAction.VOID, module = "manifest", description = "联单作废")
    public ElectronicManifest voidManifest(String manifestNo, String remark) {
        ElectronicManifest manifest = getByNo(manifestNo);
        if (manifest.getStatus() == ManifestStatus.COMPLETED) {
            throw new BusinessException(ResultCode.MANIFEST_STATUS_NOT_ALLOW, "已完结联单不可作废");
        }
        manifest.setStatus(ManifestStatus.VOID);
        manifest.getOperateLogs().add(buildLog(UserContext.get(), "VOID", remark));
        return manifestRepository.save(manifest);
    }

    @Auditable(action = AuditAction.AMEND, module = "manifest", description = "联单补录/变更")
    public ElectronicManifest amendManifest(String manifestNo, List<String> additionalTraceCodes, String remark) {
        ElectronicManifest manifest = getByNo(manifestNo);
        if (manifest.getStatus() != ManifestStatus.VALID) {
            throw new BusinessException(ResultCode.MANIFEST_STATUS_NOT_ALLOW, "仅有效联单可变更");
        }
        List<WasteRecord> additional = wasteRecordRepository.findByTraceCodeIn(additionalTraceCodes);
        for (WasteRecord r : additional) {
            manifest.getTraceCodes().add(r.getTraceCode());
            manifest.getCategoryWeights().merge(r.getCategory(), r.getWeightKg(), Double::sum);
            manifest.setTotalWeightKg(manifest.getTotalWeightKg() + r.getWeightKg());
            r.setManifestNo(manifestNo);
        }
        wasteRecordRepository.saveAll(additional);
        manifest.setStatus(ManifestStatus.AMENDED);
        manifest.getOperateLogs().add(buildLog(UserContext.get(), "AMEND", remark));
        return manifestRepository.save(manifest);
    }

    public byte[] downloadPdf(String manifestNo) {
        ElectronicManifest manifest = getByNo(manifestNo);
        return pdfService.generate(manifest);
    }

    private String generateManifestNo() {
        String date = LocalDate.now().format(DATE_FMT);
        String key = "manifest:seq:" + date;
        long seq;
        try {
            Long v = redisTemplate.opsForValue().increment(key);
            redisTemplate.expireAt(key, LocalDate.now().plusDays(2)
                    .atStartOfDay(java.time.ZoneId.systemDefault()).toInstant());
            seq = v == null ? ThreadLocalRandom.current().nextInt(1, 999999) : v;
        } catch (Exception e) {
            seq = ThreadLocalRandom.current().nextInt(1, 999999);
        }
        return "LD-" + date + "-" + String.format("%08d", seq);
    }

    private ElectronicManifest.ManifestOperateLog buildLog(UserInfo user, String action, String remark) {
        ElectronicManifest.ManifestOperateLog log = new ElectronicManifest.ManifestOperateLog();
        log.setOperatorId(user == null ? "system" : user.getUserId());
        log.setOperatorName(user == null ? "system" : user.getUsername());
        log.setAction(action);
        log.setRemark(remark);
        log.setOperateTime(LocalDateTime.now().toString());
        return log;
    }
}

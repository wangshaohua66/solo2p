package com.mw.registration.service;

import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.enums.WasteStatus;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.PageResult;
import com.mw.common.response.ResultCode;
import com.mw.common.security.UserContext;
import com.mw.common.security.UserInfo;
import com.mw.registration.document.WasteRecord;
import com.mw.registration.dto.BatchWasteRegistrationRequest;
import com.mw.registration.dto.WasteRegistrationItemDTO;
import com.mw.registration.dto.WasteRegistrationResultDTO;
import com.mw.registration.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WasteRegistrationService {

    private static final String PENDING_TRANSFER_QUEUE = "queue:pending_transfer";

    private final WasteRecordRepository wasteRecordRepository;
    private final MongoTemplate mongoTemplate;
    private final TraceCodeGenerator traceCodeGenerator;
    private final QualificationService qualificationService;
    private final ManifestService manifestService;
    private final StringRedisTemplate redisTemplate;

    @Auditable(action = AuditAction.CREATE, module = "registration", description = "批量废物登记")
    public WasteRegistrationResultDTO batchRegister(BatchWasteRegistrationRequest request) {
        UserInfo user = UserContext.get();
        String orgId = user == null ? "unknown" : user.getOrgId();
        String orgName = user == null ? "未知机构" : user.getOrgName();

        List<WasteRecord> records = new ArrayList<>(request.getRecords().size());
        for (WasteRegistrationItemDTO item : request.getRecords()) {
            qualificationService.check(orgId, item.getCategory());
            WasteRecord record = new WasteRecord();
            record.setTraceCode(traceCodeGenerator.generate(orgId, item.getCategory()));
            record.setOrgId(orgId);
            record.setOrgName(orgName);
            record.setDepartment(item.getDepartment());
            record.setCategory(item.getCategory());
            record.setWeightKg(item.getWeightKg());
            record.setPackageNo(item.getPackageNo());
            record.setOperatorId(user == null ? "system" : user.getUserId());
            record.setOperatorName(item.getOperatorName() == null ? (user == null ? "system" : user.getUsername()) : item.getOperatorName());
            record.setStorageTime(LocalDateTime.now());
            record.setStatus(WasteStatus.PENDING_TRANSFER);
            record.setAttachmentUrls(item.getAttachmentUrls());
            records.add(record);
        }

        BulkOperations bulkOps = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, WasteRecord.class);
        records.forEach(bulkOps::insert);
        bulkOps.execute();

        List<String> traceCodes = records.stream().map(WasteRecord::getTraceCode).collect(Collectors.toList());
        String manifestNo = manifestService.createManifest(orgId, orgName, traceCodes, user);

        try {
            redisTemplate.opsForList().rightPush(PENDING_TRANSFER_QUEUE, manifestNo);
        } catch (Exception e) {
            log.warn("推送待收运队列失败(非阻断): {}", e.getMessage());
        }

        log.info("批量登记完成: orgId={}, 数量={}, 联单={}", orgId, traceCodes.size(), manifestNo);
        return WasteRegistrationResultDTO.builder()
                .total(request.getRecords().size())
                .success(request.getRecords().size())
                .traceCodes(traceCodes)
                .manifestNo(manifestNo)
                .build();
    }

    public WasteRecord getByTraceCode(String traceCode) {
        return wasteRecordRepository.findByTraceCode(traceCode)
                .orElseThrow(() -> new BusinessException(ResultCode.TRACE_CODE_NOT_EXIST, "追溯编码不存在: " + traceCode));
    }

    public PageResult<WasteRecord> pageByOrg(String orgId, String category, int page, int size) {
        Criteria criteria = new Criteria();
        if (orgId != null && !orgId.isBlank()) {
            criteria.and("orgId").is(orgId);
        }
        if (category != null && !category.isBlank()) {
            criteria.and("category").is(category);
        }
        Query query = new Query(criteria);
        long total = mongoTemplate.count(query, WasteRecord.class);
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), size, Sort.Direction.DESC, "storageTime");
        List<WasteRecord> records = mongoTemplate.find(query.with(pageRequest), WasteRecord.class);
        return PageResult.of(records, total, page, size);
    }

    public void updateStatusByTraceCode(String traceCode, WasteStatus status) {
        WasteRecord record = getByTraceCode(traceCode);
        record.setStatus(status);
        wasteRecordRepository.save(record);
    }
}

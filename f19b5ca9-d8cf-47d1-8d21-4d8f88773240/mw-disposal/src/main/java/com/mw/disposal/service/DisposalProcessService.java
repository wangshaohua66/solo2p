package com.mw.disposal.service;

import cn.hutool.json.JSONUtil;
import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.enums.AlertType;
import com.mw.common.enums.DisposalMethod;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.disposal.document.DisposalBatch;
import com.mw.disposal.document.EmissionData;
import com.mw.disposal.document.TimeValue;
import com.mw.disposal.dto.DisposalBatchCreateRequest;
import com.mw.disposal.dto.EmissionLinkRequest;
import com.mw.disposal.dto.ProcessDataRequest;
import com.mw.disposal.repository.DisposalBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class DisposalProcessService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String ALERT_EVENT_QUEUE = "queue:alert_events";

    private final DisposalBatchRepository disposalBatchRepository;
    private final StringRedisTemplate redisTemplate;

    @Auditable(action = AuditAction.CREATE, module = "disposal", description = "创建处置批次")
    public DisposalBatch createBatch(DisposalBatchCreateRequest request) {
        DisposalBatch batch = new DisposalBatch();
        batch.setBatchNo(generateBatchNo());
        batch.setManifestNo(request.getManifestNo());
        batch.setTraceCodes(request.getTraceCodes());
        batch.setDisposalMethod(request.getDisposalMethod());
        batch.setStartTime(LocalDateTime.now());
        batch.setQualified(null);
        batch.setReviewStatus("PROCESSING");
        batch.setOperatorId(request.getOperatorId());
        batch.setRemark(request.getRemark());
        return disposalBatchRepository.save(batch);
    }

    @Auditable(action = AuditAction.UPDATE, module = "disposal", description = "记录处置工艺参数曲线")
    public DisposalBatch recordProcess(ProcessDataRequest request) {
        DisposalBatch batch = getByBatchNo(request.getBatchNo());
        batch.setTemperatureCurve(request.getTemperatureCurve());
        batch.setPressureCurve(request.getPressureCurve());
        batch.setSterilizationDurationMinutes(request.getSterilizationDurationMinutes());
        batch.setDurationMinutes(request.getDurationMinutes());
        batch.setEndTime(LocalDateTime.now());
        return disposalBatchRepository.save(batch);
    }

    @Auditable(action = AuditAction.UPDATE, module = "disposal", description = "关联在线排放监测数据")
    public DisposalBatch linkEmission(EmissionLinkRequest request) {
        DisposalBatch batch = getByBatchNo(request.getBatchNo());
        batch.setEmissionData(request.getEmissionData());
        return disposalBatchRepository.save(batch);
    }

    @Auditable(action = AuditAction.CONFIRM, module = "disposal", description = "处置达标判定")
    public DisposalBatch evaluateQualified(String batchNo) {
        DisposalBatch batch = getByBatchNo(batchNo);
        DisposalMethod method = batch.getDisposalMethod();
        boolean tempOk = checkTemperature(batch.getTemperatureCurve(), method.getMinTemperature());
        boolean durationOk = batch.getSterilizationDurationMinutes() != null
                && batch.getSterilizationDurationMinutes() >= method.getMinDurationMinutes();
        boolean emissionOk = batch.getEmissionData() == null || !Boolean.FALSE.equals(batch.getEmissionData().getQualified());

        boolean qualified = tempOk && durationOk && emissionOk;
        batch.setQualified(qualified);
        batch.setReviewStatus(qualified ? "QUALIFIED" : "PENDING_REVIEW");

        if (!qualified) {
            pushUnqualifiedEvent(batch, buildReason(tempOk, durationOk, emissionOk));
        }
        return disposalBatchRepository.save(batch);
    }

    public DisposalBatch getByBatchNo(String batchNo) {
        return disposalBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new BusinessException(ResultCode.NOT_FOUND, "处置批次不存在: " + batchNo));
    }

    private boolean checkTemperature(List<TimeValue> curve, double minTemperature) {
        if (curve == null || curve.isEmpty()) {
            return false;
        }
        return curve.stream().mapToDouble(TimeValue::getValue).max().orElse(0) >= minTemperature;
    }

    private String buildReason(boolean tempOk, boolean durationOk, boolean emissionOk) {
        StringBuilder sb = new StringBuilder("处置不达标: ");
        if (!tempOk) {
            sb.append("温度不足; ");
        }
        if (!durationOk) {
            sb.append("灭菌时长不足; ");
        }
        if (!emissionOk) {
            sb.append("排放数据不达标; ");
        }
        return sb.toString();
    }

    private void pushUnqualifiedEvent(DisposalBatch batch, String reason) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", AlertType.DISPOSAL_UNQUALIFIED.name());
            event.put("batchNo", batch.getBatchNo());
            event.put("manifestNo", batch.getManifestNo());
            event.put("disposalMethod", batch.getDisposalMethod() == null ? null : batch.getDisposalMethod().name());
            event.put("detail", reason);
            event.put("eventTime", LocalDateTime.now().toString());
            redisTemplate.opsForList().rightPush(ALERT_EVENT_QUEUE, JSONUtil.toJsonStr(event));
        } catch (Exception e) {
            log.warn("推送处置不达标告警事件失败(非阻断): {}", e.getMessage());
        }
    }

    private String generateBatchNo() {
        String date = LocalDate.now().format(DATE_FMT);
        String key = "batch:seq:" + date;
        long seq;
        try {
            Long v = redisTemplate.opsForValue().increment(key);
            seq = v == null ? ThreadLocalRandom.current().nextInt(1, 999999) : v;
        } catch (Exception e) {
            seq = ThreadLocalRandom.current().nextInt(1, 999999);
        }
        return "DS-" + date + "-" + String.format("%06d", seq);
    }
}

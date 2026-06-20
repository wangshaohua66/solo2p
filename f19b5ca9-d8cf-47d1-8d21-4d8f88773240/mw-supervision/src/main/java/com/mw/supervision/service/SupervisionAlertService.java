package com.mw.supervision.service;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.enums.AlertLevel;
import com.mw.common.enums.AlertType;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.common.security.UserContext;
import com.mw.supervision.document.Alert;
import com.mw.supervision.document.AlertRule;
import com.mw.supervision.dto.AlertConfirmRequest;
import com.mw.supervision.repository.AlertRepository;
import com.mw.supervision.repository.AlertRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SupervisionAlertService {

    private static final String ALERT_EVENT_QUEUE = "queue:alert_events";
    private static final String PROVINCIAL_PLATFORM = "省固废监管平台";

    private final AlertRepository alertRepository;
    private final AlertRuleRepository alertRuleRepository;
    private final MongoTemplate mongoTemplate;
    private final StringRedisTemplate redisTemplate;

    @Value("${mw.supervision.provincial-push-url:}")
    private String provincialPushUrl;

    @Value("${mw.supervision.weight-diff-ratio:0.05}")
    private double weightDiffRatio;

    public AlertRule saveRule(AlertRule rule) {
        return alertRuleRepository.save(rule);
    }

    public List<AlertRule> listRules() {
        return alertRuleRepository.findAll();
    }

    @Scheduled(fixedDelayString = "${mw.supervision.scan-interval-ms:300000}")
    public void scheduledScan() {
        int created = manualScan();
        if (created > 0) {
            log.info("定时监管扫描完成，新增预警 {} 条", created);
        }
    }

    @Scheduled(fixedDelayString = "${mw.supervision.consume-interval-ms:10000}")
    public void scheduledConsume() {
        consumeAlertEvents();
    }

    public int manualScan() {
        int count = 0;
        count += scanStorageTimeout();
        count += scanWeightDifference();
        count += scanDisposalUnqualified();
        return count;
    }

    private int scanStorageTimeout() {
        AlertRule rule = getRule(AlertType.STORAGE_TIMEOUT);
        if (rule == null || Boolean.FALSE.equals(rule.getEnabled())) {
            return 0;
        }
        double hours = rule.getThreshold() == null ? 48 : rule.getThreshold();
        LocalDateTime threshold = LocalDateTime.now().minusHours((long) hours);
        Query query = Query.query(Criteria.where("storageTime").lt(threshold)
                .and("status").is("PENDING_TRANSFER"));
        List<Document> records = mongoTemplate.find(query, Document.class, "waste_record");
        int count = 0;
        for (Document r : records) {
            String traceCode = r.getString("traceCode");
            if (createAlert(AlertType.STORAGE_TIMEOUT, rule.getLevel(), traceCode,
                    r.getString("orgId"), "废物暂存超过" + hours + "小时: " + traceCode)) {
                count++;
            }
        }
        return count;
    }

    private int scanWeightDifference() {
        Query query = Query.query(Criteria.where("actualWeightKg").ne(null).ne(0.0));
        List<Document> orders = mongoTemplate.find(query, Document.class, "dispatch_order");
        int count = 0;
        for (Document o : orders) {
            Double planned = o.getDouble("plannedWeightKg");
            Double actual = o.getDouble("actualWeightKg");
            if (planned == null || planned == 0 || actual == null) {
                continue;
            }
            double diff = Math.abs(actual - planned) / planned;
            if (diff > weightDiffRatio) {
                String orderNo = o.getString("orderNo");
                if (createAlert(AlertType.WEIGHT_DIFFERENCE, AlertLevel.WARNING, orderNo,
                        o.getString("orgId"), String.format("收运重量差异超%.0f%%: 派单 %s", weightDiffRatio * 100, orderNo))) {
                    count++;
                }
            }
        }
        return count;
    }

    private int scanDisposalUnqualified() {
        Query query = Query.query(Criteria.where("qualified").is(false).and("reviewStatus").is("PENDING_REVIEW"));
        List<Document> batches = mongoTemplate.find(query, Document.class, "disposal_batch");
        int count = 0;
        for (Document b : batches) {
            String batchNo = b.getString("batchNo");
            if (createAlert(AlertType.DISPOSAL_UNQUALIFIED, AlertLevel.URGENT, batchNo,
                    null, "处置不达标待复核: " + batchNo)) {
                count++;
            }
        }
        return count;
    }

    private void consumeAlertEvents() {
        int max = 500;
        for (int i = 0; i < max; i++) {
            String json = redisTemplate.opsForList().leftPop(ALERT_EVENT_QUEUE);
            if (json == null) {
                break;
            }
            try {
                JSONObject event = JSONUtil.parseObj(json);
                String typeStr = event.getStr("type");
                AlertType type = AlertType.valueOf(typeStr);
                String businessKey = event.getStr("vehicleId") != null ? event.getStr("vehicleId") : event.getStr("batchNo");
                createAlert(type, levelFor(type), businessKey, event.getStr("manifestNo"), event.getStr("detail"));
            } catch (Exception e) {
                log.warn("消费告警事件失败: {}", e.getMessage());
            }
        }
    }

    private AlertLevel levelFor(AlertType type) {
        return switch (type) {
            case ROUTE_DEVIATION -> AlertLevel.WARNING;
            case DISPOSAL_UNQUALIFIED -> AlertLevel.URGENT;
            default -> AlertLevel.INFO;
        };
    }

    private boolean createAlert(AlertType type, AlertLevel level, String businessKey, String orgId, String detail) {
        if (businessKey == null) {
            businessKey = "unknown";
        }
        if (alertRepository.findByTypeAndBusinessKeyAndStatus(type.name(), businessKey, "PENDING").isPresent()) {
            return false;
        }
        if (level == null) {
            level = AlertLevel.WARNING;
        }
        Alert alert = new Alert();
        alert.setType(type);
        alert.setLevel(level);
        alert.setBusinessKey(businessKey);
        alert.setOrgId(orgId);
        alert.setDetail(detail);
        alert.setStatus("PENDING");
        alert.setPushStatus("NOT_PUSHED");
        alertRepository.save(alert);
        pushAlert(alert);
        return true;
    }

    @Auditable(action = AuditAction.OTHER, module = "supervision", description = "推送预警至省固废平台")
    public void pushAlert(Alert alert) {
        if (provincialPushUrl == null || provincialPushUrl.isBlank()) {
            log.debug("未配置省固废平台推送地址，跳过推送: alertId={}", alert.getId());
            return;
        }
        try {
            RestClient client = RestClient.create();
            client.post()
                    .uri(provincialPushUrl)
                    .body(alert)
                    .retrieve()
                    .toBodilessEntity();
            alert.setPushStatus("PUSHED");
            alert.setPushedTo(PROVINCIAL_PLATFORM);
            alert.setPushTime(LocalDateTime.now());
        } catch (Exception e) {
            log.warn("推送省固废平台失败: alertId={}, msg={}", alert.getId(), e.getMessage());
            alert.setPushStatus("FAILED");
        }
        alertRepository.save(alert);
    }

    @Auditable(action = AuditAction.CONFIRM, module = "supervision", description = "预警确认与处理反馈")
    public Alert confirmAlert(AlertConfirmRequest request) {
        Alert alert = alertRepository.findById(request.getAlertId())
                .orElseThrow(() -> new BusinessException(ResultCode.ALERT_RULE_NOT_EXIST, "预警不存在"));
        alert.setStatus("RESOLVED");
        alert.setConfirmTime(LocalDateTime.now());
        alert.setConfirmUser(UserContext.currentUsername());
        alert.setFeedback(request.getFeedback());
        return alertRepository.save(alert);
    }

    public List<Alert> listAlerts(String type, String status, String level, int page, int size) {
        Criteria criteria = new Criteria();
        if (type != null && !type.isBlank()) {
            criteria.and("type").is(type);
        }
        if (status != null && !status.isBlank()) {
            criteria.and("status").is(status);
        }
        if (level != null && !level.isBlank()) {
            criteria.and("level").is(level);
        }
        Query query = Query.query(criteria);
        long total = mongoTemplate.count(query, Alert.class);
        query.skip((long) (page - 1) * size).limit(size);
        List<Alert> alerts = mongoTemplate.find(query, Alert.class);
        return alerts;
    }

    private AlertRule getRule(AlertType type) {
        return alertRuleRepository.findByType(type).orElseGet(() -> defaultRule(type));
    }

    private AlertRule defaultRule(AlertType type) {
        AlertRule rule = new AlertRule();
        rule.setType(type);
        rule.setLevel(AlertLevel.WARNING);
        rule.setEnabled(true);
        rule.setThreshold(switch (type) {
            case STORAGE_TIMEOUT -> 48.0;
            case WEIGHT_DIFFERENCE -> 0.05;
            case ROUTE_DEVIATION -> 2.0;
            default -> 0.0;
        });
        return rule;
    }
}

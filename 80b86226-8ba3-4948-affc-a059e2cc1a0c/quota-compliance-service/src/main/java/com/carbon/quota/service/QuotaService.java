package com.carbon.quota.service;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
import com.carbon.common.integration.WebhookNotifier;
import com.carbon.quota.entity.CcerTransfer;
import com.carbon.quota.entity.QuotaAlert;
import com.carbon.quota.entity.QuotaAllocation;
import com.carbon.quota.entity.QuotaLedger;
import com.carbon.quota.repository.CcerTransferRepository;
import com.carbon.quota.repository.QuotaAlertRepository;
import com.carbon.quota.repository.QuotaAllocationRepository;
import com.carbon.quota.repository.QuotaLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuotaService {

    private final QuotaAllocationRepository allocationRepo;
    private final QuotaLedgerRepository ledgerRepo;
    private final QuotaAlertRepository alertRepo;
    private final CcerTransferRepository ccerRepo;
    private final WebhookNotifier webhook;

    @Value("${quota.compliance.offset-limit-percent:5}")
    private int offsetLimitPercent;

    @Value("${quota.alert.dingtalk-url:}")
    private String dingtalkUrl;

    @Value("${quota.alert.feishu-url:}")
    private String feishuUrl;

    private final Map<QuotaAlert.Level, BigDecimal> thresholds = new EnumMap<>(QuotaAlert.Level.class);

    @Value("${quota.compliance.alert-thresholds.department:0.05}")
    public void setDeptThreshold(BigDecimal v) { thresholds.put(QuotaAlert.Level.DEPARTMENT, v); }
    @Value("${quota.compliance.alert-thresholds.enterprise:0.10}")
    public void setEntThreshold(BigDecimal v) { thresholds.put(QuotaAlert.Level.ENTERPRISE, v); }
    @Value("${quota.compliance.alert-thresholds.group:0.20}")
    public void setGrpThreshold(BigDecimal v) { thresholds.put(QuotaAlert.Level.GROUP, v); }

    @AuditLog(module = "配额管理", operation = "创建年度配额分配", resourceType = "QuotaAllocation")
    @Transactional
    public QuotaAllocation createAllocation(QuotaAllocation allocation) {
        String tenantId = UserContextHolder.getTenantId();
        allocation.setTenantId(tenantId);
        allocationRepo.findByTenantIdAndComplianceYearAndOrganizationId(
                        tenantId, allocation.getComplianceYear(), allocation.getOrganizationId())
                .ifPresent(a -> {
                    throw new BusinessException(ErrorCode.QUOTA_ALLOCATION_FAILED,
                            "该年度该机构已存在配额分配");
                });
        BigDecimal totalQuota = Optional.ofNullable(allocation.getFreeQuota()).orElse(BigDecimal.ZERO)
                .add(Optional.ofNullable(allocation.getPaidQuota()).orElse(BigDecimal.ZERO))
                .add(Optional.ofNullable(allocation.getPreAllocatedQuota()).orElse(BigDecimal.ZERO));
        BigDecimal finalQuota = Optional.ofNullable(allocation.getFinalApprovedQuota()).orElse(totalQuota);
        BigDecimal limit = finalQuota.multiply(BigDecimal.valueOf(offsetLimitPercent))
                .divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        allocation.setMaxCcerOffsetTons(limit);
        if (allocation.getUsedCcerOffsetTons() == null) allocation.setUsedCcerOffsetTons(BigDecimal.ZERO);
        return allocationRepo.save(allocation);
    }

    public List<QuotaAllocation> listAllocations(Integer year) {
        return allocationRepo.findByTenantIdAndComplianceYear(UserContextHolder.getTenantId(), year);
    }

    public PageResult<QuotaAllocation> pageAllocations(PageQuery pq) {
        var page = allocationRepo.findByTenantIdOrderByComplianceYearDesc(
                UserContextHolder.getTenantId(),
                PageRequest.of(pq.getPage(), pq.getSize(), Sort.by(Sort.Direction.DESC, "complianceYear")));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public QuotaAllocation getAllocation(String id) {
        return allocationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("配额分配", id));
    }

    @AuditLog(module = "配额履约", operation = "月度配额对账", resourceType = "QuotaLedger")
    @Transactional
    public QuotaLedger reconcileMonth(Integer year, Integer month, String orgId,
                                      BigDecimal actualEmission, String taskId,
                                      List<String> evidenceIds) {
        if (year == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "年度不能为空");
        }
        if (month == null || month < 1 || month > 12) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "月份必须在1-12");
        }
        if (orgId == null || orgId.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "机构ID不能为空");
        }
        if (actualEmission == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "实际排放量不能为空");
        }
        if (actualEmission.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "实际排放量不能为负数");
        }
        if (UserContextHolder.getNullable() == null || UserContextHolder.getTenantId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "租户上下文为空");
        }
        com.carbon.common.verification.EvidenceChainValidator.requireEvidence(
                evidenceIds, "配额台账");
        String tenantId = UserContextHolder.getTenantId();
        String period = String.format("%04d-%02d", year, month);
        QuotaAllocation alloc = allocationRepo.findByTenantIdAndComplianceYearAndOrganizationId(tenantId, year, orgId)
                .orElseThrow(() -> new BusinessException(ErrorCode.QUOTA_ALLOCATION_FAILED,
                        "请先创建该年度配额分配"));

        QuotaLedger prev = null;
        if (month > 1) {
            prev = ledgerRepo.findByTenantIdAndComplianceYearAndMonthAndOrganizationId(tenantId, year, month - 1, orgId)
                    .orElse(null);
        }
        BigDecimal monthlyQuota = Optional.ofNullable(alloc.getFinalApprovedQuota()).orElse(
                        Optional.ofNullable(alloc.getFreeQuota()).orElse(BigDecimal.ZERO)
                                .add(Optional.ofNullable(alloc.getPaidQuota()).orElse(BigDecimal.ZERO)))
                .divide(BigDecimal.valueOf(12), 10, RoundingMode.HALF_UP);

        BigDecimal cumulativeAlloc = (prev != null ? prev.getCumulativeAllocated() : BigDecimal.ZERO)
                .add(monthlyQuota);
        BigDecimal cumulativeEmission = (prev != null ? prev.getCumulativeEmission() : BigDecimal.ZERO)
                .add(actualEmission);

        int monthsLeft = 12 - month;
        BigDecimal projectedYearEnd = cumulativeEmission.add(
                monthsLeft > 0 ? actualEmission.multiply(BigDecimal.valueOf(monthsLeft)) : BigDecimal.ZERO);
        BigDecimal expectedGap = projectedYearEnd.subtract(
                Optional.ofNullable(alloc.getFinalApprovedQuota()).orElse(
                        Optional.ofNullable(alloc.getFreeQuota()).orElse(BigDecimal.ZERO)
                                .add(Optional.ofNullable(alloc.getPaidQuota()).orElse(BigDecimal.ZERO))));

        QuotaLedger ledger = ledgerRepo
                .findByTenantIdAndComplianceYearAndMonthAndOrganizationId(tenantId, year, month, orgId)
                .orElseGet(QuotaLedger::new);
        ledger.setTenantId(tenantId);
        ledger.setComplianceYear(year);
        ledger.setMonth(month);
        ledger.setPeriod(period);
        ledger.setOrganizationId(orgId);
        ledger.setOrganizationName(alloc.getOrganizationName());
        ledger.setOpeningBalance(prev != null ? prev.getClosingBalance() : BigDecimal.ZERO);
        ledger.setAllocatedIn(monthlyQuota);
        ledger.setActualEmission(actualEmission);
        ledger.setCumulativeEmission(cumulativeEmission);
        ledger.setCumulativeAllocated(cumulativeAlloc);
        ledger.setExpectedGap(expectedGap);
        ledger.setClosingBalance(cumulativeAlloc.subtract(cumulativeEmission));
        ledger.setCalculationTaskId(taskId);
        ledger.setReconciliationDate(LocalDate.now());
        ledger.setStatus("RECONCILED");
        ledger.setEvidenceIds(evidenceIds);
        ledger = ledgerRepo.save(ledger);

        evaluateAndTriggerAlerts(ledger, alloc);
        return ledger;
    }

    private void evaluateAndTriggerAlerts(QuotaLedger ledger, QuotaAllocation alloc) {
        if (ledger.getExpectedGap() == null
                || ledger.getExpectedGap().compareTo(BigDecimal.ZERO) <= 0) return;

        BigDecimal totalQuota = Optional.ofNullable(alloc.getFinalApprovedQuota()).orElse(
                Optional.ofNullable(alloc.getFreeQuota()).orElse(BigDecimal.ZERO)
                        .add(Optional.ofNullable(alloc.getPaidQuota()).orElse(BigDecimal.ZERO)));
        BigDecimal gapPercent = totalQuota.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO
                : ledger.getExpectedGap().divide(totalQuota, 6, RoundingMode.HALF_UP);

        List<QuotaAlert.Level> triggered = new ArrayList<>();
        for (Map.Entry<QuotaAlert.Level, BigDecimal> e : thresholds.entrySet()) {
            if (gapPercent.compareTo(e.getValue()) >= 0) triggered.add(e.getKey());
        }
        if (triggered.isEmpty()) return;

        for (QuotaAlert.Level level : triggered) {
            QuotaAlert alert = QuotaAlert.builder()
                    .tenantId(ledger.getTenantId())
                    .ledgerId(ledger.getId())
                    .complianceYear(ledger.getComplianceYear())
                    .month(ledger.getMonth())
                    .period(ledger.getPeriod())
                    .organizationId(ledger.getOrganizationId())
                    .organizationName(ledger.getOrganizationName())
                    .cumulativeAllocated(ledger.getCumulativeAllocated())
                    .cumulativeEmission(ledger.getCumulativeEmission())
                    .expectedGap(ledger.getExpectedGap())
                    .gapPercent(gapPercent.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP))
                    .level(level)
                    .title(String.format("[%s预警] %s 年%d月 配额缺口预警",
                            translate(level), ledger.getOrganizationName(),
                            ledger.getComplianceYear(), ledger.getMonth()))
                    .content(buildAlertContent(ledger, alloc, gapPercent, level))
                    .notifiedAt(Instant.now())
                    .status("NOTIFIED")
                    .build();
            alert = alertRepo.save(alert);
            dispatchAlert(alert);
        }
    }

    private String buildAlertContent(QuotaLedger l, QuotaAllocation alloc, BigDecimal gapPct, QuotaAlert.Level level) {
        return String.format("## 配额缺口预警 (%s)\n\n" +
                        "- 机构: **%s**\n" +
                        "- 期间: %d-%02d\n" +
                        "- 累计已分配配额: %.2f tCO2e\n" +
                        "- 累计实际排放: %.2f tCO2e\n" +
                        "- 预计年末缺口: **%.2f tCO2e**\n" +
                        "- 缺口率: **%.2f%%**\n\n" +
                        "⚠️ 请尽快安排CCER抵消或有偿配额采购，缺口阈值级别=%s",
                translate(level), l.getOrganizationName(),
                l.getComplianceYear(), l.getMonth(),
                l.getCumulativeAllocated(), l.getCumulativeEmission(),
                l.getExpectedGap(),
                gapPct.multiply(BigDecimal.valueOf(100)),
                translate(level));
    }

    private void dispatchAlert(QuotaAlert alert) {
        Map<String, Boolean> cs = new HashMap<>();
        if (feishuUrl != null && !feishuUrl.isBlank()) {
            try {
                webhook.sendFeishuInteractive(feishuUrl,
                        alert.getTitle(), alert.getContent(),
                        resolveColor(alert.getLevel()),
                        List.of(Map.of("tag", "button", "text",
                                Map.of("tag", "plain_text", "content", "查看详情"),
                                "url", "https://carbon.example.com/alerts/" + alert.getId(),
                                "type", "primary")));
                cs.put("feishu", true);
            } catch (Exception e) {
                cs.put("feishu", false);
                log.warn("Feishu alert send failed: {}", e.getMessage());
            }
        }
        if (dingtalkUrl != null && !dingtalkUrl.isBlank()) {
            try {
                webhook.sendDingtalkMarkdown(dingtalkUrl, null,
                        alert.getTitle(), alert.getContent(), null, false);
                cs.put("dingtalk", true);
            } catch (Exception e) {
                cs.put("dingtalk", false);
                log.warn("Dingtalk alert send failed: {}", e.getMessage());
            }
        }
        alert.setChannelStatus(cs);
        alertRepo.save(alert);
    }

    private String resolveColor(QuotaAlert.Level level) {
        return switch (level) {
            case DEPARTMENT -> "blue";
            case ENTERPRISE -> "orange";
            case GROUP -> "red";
        };
    }

    private String translate(QuotaAlert.Level level) {
        return switch (level) {
            case DEPARTMENT -> "部门级";
            case ENTERPRISE -> "企业级";
            case GROUP -> "集团级";
        };
    }

    @AuditLog(module = "配额履约", operation = "CCER 转入抵消履约", resourceType = "CcerTransfer")
    @Transactional
    public CcerTransfer applyCcerOffset(CcerTransfer transfer) {
        String tenantId = UserContextHolder.getTenantId();
        transfer.setTenantId(tenantId);
        QuotaAllocation alloc = allocationRepo.findByTenantIdAndComplianceYearAndOrganizationId(
                        tenantId, transfer.getComplianceYear(),
                        UserContextHolder.getNullable() != null && UserContextHolder.getNullable().getOrganizationId() != null
                                ? UserContextHolder.get().getOrganizationId()
                                : UserContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.QUOTA_ALLOCATION_FAILED, "未找到对应年度配额分配"));

        BigDecimal used = Optional.ofNullable(alloc.getUsedCcerOffsetTons()).orElse(BigDecimal.ZERO);
        BigDecimal limit = Optional.ofNullable(alloc.getMaxCcerOffsetTons()).orElse(BigDecimal.ZERO);
        if (used.add(transfer.getTransferTons()).compareTo(limit) > 0) {
            throw new BusinessException(ErrorCode.QUOTA_OFFSET_EXCEED,
                    String.format("CCER 抵消超限，已用 %.2f，上限 %.2f，本次申请 %.2f",
                            used, limit, transfer.getTransferTons()));
        }
        alloc.setUsedCcerOffsetTons(used.add(transfer.getTransferTons()));
        allocationRepo.save(alloc);

        transfer.setStatus("APPROVED");
        if (transfer.getTotalValue() == null && transfer.getPricePerTon() != null) {
            transfer.setTotalValue(transfer.getPricePerTon().multiply(transfer.getTransferTons()));
        }
        CcerTransfer saved = ccerRepo.save(transfer);

        if (transfer.getLedgerId() != null) {
            ledgerRepo.findById(transfer.getLedgerId()).ifPresent(l -> {
                l.setCcerOffsetIn((l.getCcerOffsetIn() == null ? BigDecimal.ZERO : l.getCcerOffsetIn())
                        .add(transfer.getTransferTons()));
                l.setCcerUsed((l.getCcerUsed() == null ? BigDecimal.ZERO : l.getCcerUsed())
                        .add(transfer.getTransferTons()));
                ledgerRepo.save(l);
            });
        }
        return saved;
    }

    @AuditLog(module = "配额履约", operation = "CCER签发自动转入履约", resourceType = "CcerTransfer")
    @Transactional
    public CcerTransfer autoTransferFromIssuance(Map<String, Object> request) {
        String issuanceId = (String) request.get("issuanceId");
        String projectId = (String) request.get("projectId");
        String projectCode = (String) request.get("projectCode");
        String projectName = (String) request.get("projectName");
        BigDecimal tons = toBigDecimal(request.get("tons"));
        Integer complianceYear = request.get("complianceYear") != null
                ? ((Number) request.get("complianceYear")).intValue()
                : java.time.LocalDate.now().getYear();

        CcerTransfer transfer = CcerTransfer.builder()
                .ccerIssuanceId(issuanceId)
                .projectId(projectId)
                .projectName(projectName != null ? projectName : projectCode)
                .projectCode(projectCode)
                .methodology("CCER")
                .transferTons(tons)
                .complianceYear(complianceYear)
                .transferDate(java.time.LocalDate.now())
                .status("APPROVED")
                .build();

        return applyCcerOffset(transfer);
    }

    public List<CcerTransfer> listCcerTransfers(Integer year) {
        return ccerRepo.findByTenantIdAndComplianceYearOrderByTransferDateDesc(
                UserContextHolder.getTenantId(), year);
    }

    private BigDecimal toBigDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(o));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    public Map<String, Object> dashboard(Integer year) {
        String tenantId = UserContextHolder.getTenantId();
        Map<String, Object> out = new LinkedHashMap<>();
        List<QuotaAllocation> allocs = allocationRepo.findByTenantIdAndComplianceYear(tenantId, year);
        List<QuotaLedger> ledgers = ledgerRepo.findByTenantIdAndComplianceYearOrderByMonthAsc(tenantId, year);
        var yearSummary = ledgerRepo.summarizeYear(tenantId, year);
        var usedCcer = ccerRepo.sumUsedCcer(tenantId, year);
        BigDecimal totalAlloc = allocs.stream()
                .map(a -> Optional.ofNullable(a.getFinalApprovedQuota()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal usedCcerVal = !usedCcer.isEmpty() && usedCcer.get(0) != null
                ? (BigDecimal) usedCcer.get(0).get("total") : BigDecimal.ZERO;
        out.put("year", year);
        out.put("totalAllocated", totalAlloc);
        out.put("usedCcer", usedCcerVal);
        out.put("yearSummary", yearSummary);
        out.put("allocations", allocs);
        out.put("ledgers", ledgers);
        out.put("openAlerts", alertRepo.countByTenantIdAndStatus(tenantId, "OPEN"));
        return out;
    }

    public List<QuotaLedger> listLedgers(Integer year) {
        return ledgerRepo.findByTenantIdAndComplianceYearOrderByMonthAsc(UserContextHolder.getTenantId(), year);
    }

    public PageResult<QuotaAlert> listAlerts(String status, PageQuery pq) {
        Page<QuotaAlert> page;
        if (status != null && !status.isBlank()) {
            page = alertRepo.findByTenantIdAndStatus(UserContextHolder.getTenantId(), status,
                    PageRequest.of(pq.getPage(), pq.getSize(), Sort.by(Sort.Direction.DESC, "createdAt")));
        } else {
            page = alertRepo.findByTenantIdOrderByCreatedAtDesc(UserContextHolder.getTenantId(),
                    PageRequest.of(pq.getPage(), pq.getSize()));
        }
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public QuotaAlert acknowledgeAlert(String alertId, String note) {
        QuotaAlert alert = alertRepo.findById(alertId)
                .orElseThrow(() -> new NotFoundException("预警", alertId));
        alert.setStatus("ACKNOWLEDGED");
        return alertRepo.save(alert);
    }
}

package com.carbon.ccer.service;

import cn.hutool.core.util.IdUtil;
import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.ccer.entity.CcerIssuance;
import com.carbon.ccer.entity.CcerProject;
import com.carbon.ccer.entity.CcerValidation;
import com.carbon.ccer.entity.CcerVerification;
import com.carbon.ccer.repository.CcerIssuanceRepository;
import com.carbon.ccer.repository.CcerProjectRepository;
import com.carbon.ccer.repository.CcerValidationRepository;
import com.carbon.ccer.repository.CcerVerificationRepository;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
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
import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CcerService {

    private final CcerProjectRepository projectRepo;
    private final CcerValidationRepository validationRepo;
    private final CcerVerificationRepository verificationRepo;
    private final CcerIssuanceRepository issuanceRepo;

    @Value("${ccer.issuance.buffer-percent:2}")
    private int bufferPercent;

    @AuditLog(module = "CCER项目", operation = "创建项目", resourceType = "CCER_PROJECT")
    @Transactional
    public CcerProject createProject(CcerProject p) {
        String tenantId = UserContextHolder.getTenantId();
        p.setTenantId(tenantId);
        p.setProjectCode("CCER-" + Year.now() + "-" +
                IdUtil.fastSimpleUUID().substring(0, 6).toUpperCase(Locale.ROOT));
        p.setStatus(CcerProject.Status.DRAFT);
        p.setStatusHistory(new ArrayList<>(List.of(CcerProject.Status.DRAFT)));
        if (p.getCumulativeIssued() == null) p.setCumulativeIssued(BigDecimal.ZERO);
        if (p.getCumulativeEstimated() == null) p.setCumulativeEstimated(BigDecimal.ZERO);
        return projectRepo.save(p);
    }

    public CcerProject getProject(String id) {
        return projectRepo.findById(id).orElseThrow(() -> new NotFoundException("CCER项目", id));
    }

    public PageResult<CcerProject> listProjects(CcerProject.Status status, CcerProject.Type type, PageQuery pq) {
        String tenantId = UserContextHolder.getTenantId();
        Page<CcerProject> page;
        if (status != null) {
            page = projectRepo.findByTenantIdAndStatus(tenantId, status,
                    PageRequest.of(pq.getPage(), pq.getSize(), Sort.by(Sort.Direction.DESC, "createdAt")));
        } else {
            page = projectRepo.findByTenantIdOrderByCreatedAtDesc(tenantId,
                    PageRequest.of(pq.getPage(), pq.getSize()));
        }
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    @AuditLog(module = "CCER项目", operation = "提交备案", resourceType = "CCER_PROJECT")
    @Transactional
    public CcerProject submitProject(String projectId) {
        return transitionStatus(projectId, CcerProject.Status.SUBMITTED);
    }

    @AuditLog(module = "CCER审定", operation = "提交审定报告", resourceType = "CCER_PROJECT")
    @Transactional
    public CcerValidation submitValidation(String projectId, CcerValidation v) {
        CcerProject p = getProject(projectId);
        v.setProjectId(projectId);
        v.setTenantId(p.getTenantId());
        CcerValidation saved = validationRepo.save(v);
        transitionStatus(projectId, CcerProject.Status.VALIDATION_PASSED);
        return saved;
    }

    public List<CcerValidation> listValidations(String projectId) {
        return validationRepo.findByProjectIdOrderByReportDateDesc(projectId);
    }

    @AuditLog(module = "CCER核证", operation = "提交核证报告", resourceType = "CCER_PROJECT")
    @Transactional
    public CcerVerification submitVerification(String projectId, CcerVerification v) {
        CcerProject p = getProject(projectId);
        v.setProjectId(projectId);
        v.setTenantId(p.getTenantId());
        if (v.getStatus() == null) v.setStatus(CcerVerification.Status.SUBMITTED);
        CcerVerification saved = verificationRepo.save(v);
        transitionStatus(projectId, CcerProject.Status.VERIFICATION_SUBMITTED);
        return saved;
    }

    public CcerVerification updateVerificationStatus(String verificationId, CcerVerification.Status next) {
        CcerVerification v = verificationRepo.findById(verificationId)
                .orElseThrow(() -> new NotFoundException("CCER核证", verificationId));
        v.setStatus(next);
        if (next == CcerVerification.Status.VERIFIED) {
            transitionStatus(v.getProjectId(), CcerProject.Status.ISSUED);
        }
        return verificationRepo.save(v);
    }

    public List<CcerVerification> listVerifications(String projectId) {
        return verificationRepo.findByProjectIdOrderByPeriodStartDesc(projectId);
    }

    @AuditLog(module = "CCER签发", operation = "签发减排量", resourceType = "CCER_PROJECT")
    @Transactional
    public CcerIssuance issueCredits(String projectId, String verificationId) {
        CcerProject p = getProject(projectId);
        CcerVerification v = verificationRepo.findByProjectIdAndId(projectId, verificationId)
                .orElseThrow(() -> new NotFoundException("CCER核证", verificationId));
        if (v.getStatus() != CcerVerification.Status.VERIFIED) {
            throw new BusinessException(ErrorCode.CCER_ISSUE_AMOUNT_INVALID,
                    "核证必须先通过VERIFIED才能签发");
        }
        BigDecimal verified = v.getVerifiedReduction();
        verified = verified == null ? BigDecimal.ZERO : verified;
        if (verified.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.CCER_ISSUE_AMOUNT_INVALID, "核证减排量必须为正");
        }
        BigDecimal buffer = verified.multiply(BigDecimal.valueOf(bufferPercent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal issued = verified.subtract(buffer);
        if (issued.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.CCER_ISSUE_AMOUNT_INVALID,
                    "扣减缓冲量后签发量为零");
        }
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMM");
        String prefix = "CN" + p.getProjectCode() + "-" + LocalDate.now().format(fmt);
        int num = issued.setScale(0, RoundingMode.DOWN).intValueExact();

        CcerIssuance issuance = CcerIssuance.builder()
                .projectId(projectId)
                .projectCode(p.getProjectCode())
                .projectName(p.getProjectName())
                .verificationId(verificationId)
                .periodStart(v.getPeriodStart())
                .periodEnd(v.getPeriodEnd())
                .verifiedReductionTco2e(verified)
                .bufferDeductionTco2e(buffer)
                .issuedTons(issued)
                .serialNumberPrefix(prefix)
                .serialNumberStart(prefix + "-000001")
                .serialNumberEnd(prefix + "-" + String.format("%06d", Math.max(num, 1)))
                .serialBlockSize(Math.max(num, 1))
                .approveDate(LocalDate.now())
                .approveNo("签发单-" + IdUtil.fastSimpleUUID().substring(0, 8).toUpperCase())
                .status(CcerIssuance.Status.ISSUED)
                .availableTons(issued)
                .transferredTons(BigDecimal.ZERO)
                .retiredTons(BigDecimal.ZERO)
                .build();
        issuance.setTenantId(p.getTenantId());
        CcerIssuance saved = issuanceRepo.save(issuance);

        p.setCumulativeIssued(p.getCumulativeIssued().add(issued));
        p.setStatus(CcerProject.Status.ISSUED);
        projectRepo.save(p);
        return saved;
    }

    public List<CcerIssuance> listIssuances(String projectId) {
        return issuanceRepo.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    public PageResult<CcerIssuance> pageIssuances(PageQuery pq) {
        Page<CcerIssuance> page = issuanceRepo.findByTenantIdOrderByCreatedAtDesc(
                UserContextHolder.getTenantId(),
                PageRequest.of(pq.getPage(), pq.getSize()));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    @Transactional
    public CcerIssuance transferIssuance(String issuanceId,
                                          BigDecimal tons, String targetTenantId) {
        CcerIssuance iss = issuanceRepo.findById(issuanceId)
                .orElseThrow(() -> new NotFoundException("CCER签发量", issuanceId));
        if (iss.getStatus() != CcerIssuance.Status.ISSUED) {
            throw new BusinessException(ErrorCode.QUOTA_NOT_ENOUGH, "该签发量不可转让");
        }
        if (tons.compareTo(iss.getAvailableTons()) > 0) {
            throw new BusinessException(ErrorCode.QUOTA_NOT_ENOUGH, "可转让额度不足");
        }
        iss.setAvailableTons(iss.getAvailableTons().subtract(tons));
        iss.setTransferredTons(Optional.ofNullable(iss.getTransferredTons())
                .orElse(BigDecimal.ZERO).add(tons));
        iss.setTransferToTenantId(targetTenantId);
        if (iss.getAvailableTons().compareTo(BigDecimal.ZERO) == 0) {
            iss.setStatus(CcerIssuance.Status.TRANSFERRED);
        }
        return issuanceRepo.save(iss);
    }

    @Transactional
    public CcerIssuance retireIssuance(String issuanceId, BigDecimal tons, String note) {
        CcerIssuance iss = issuanceRepo.findById(issuanceId)
                .orElseThrow(() -> new NotFoundException("CCER签发量", issuanceId));
        if (tons.compareTo(iss.getAvailableTons()) > 0) {
            throw new BusinessException(ErrorCode.QUOTA_NOT_ENOUGH, "可注销额度不足");
        }
        iss.setAvailableTons(iss.getAvailableTons().subtract(tons));
        iss.setRetiredTons(Optional.ofNullable(iss.getRetiredTons())
                .orElse(BigDecimal.ZERO).add(tons));
        iss.setRetireNote(note);
        if (iss.getAvailableTons().compareTo(BigDecimal.ZERO) == 0) {
            iss.setStatus(CcerIssuance.Status.RETIRED);
        }
        return issuanceRepo.save(iss);
    }

    public Map<String, Object> portfolio() {
        String t = UserContextHolder.getTenantId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projects", Map.of(
                "total", projectRepo.count(),
                "issuedCount", projectRepo.countByTenantIdAndStatus(t, CcerProject.Status.ISSUED),
                "implementing", projectRepo.countByTenantIdAndStatus(t, CcerProject.Status.IMPLEMENTING),
                "draft", projectRepo.countByTenantIdAndStatus(t, CcerProject.Status.DRAFT)
        ));
        List<org.bson.Document> issuedSum = issuanceRepo.sumIssued(t);
        List<org.bson.Document> availSum = issuanceRepo.sumAvailable(t);
        BigDecimal total = issuedSum.isEmpty() ? BigDecimal.ZERO
                : issuedSum.get(0).get("total", BigDecimal.class);
        BigDecimal avail = availSum.isEmpty() ? BigDecimal.ZERO
                : availSum.get(0).get("total", BigDecimal.class);
        out.put("credits", Map.of(
                "cumulativeIssuedTons", total,
                "availableTons", avail
        ));
        return out;
    }

    private CcerProject transitionStatus(String projectId, CcerProject.Status next) {
        CcerProject p = getProject(projectId);
        if (!isValidTransition(p.getStatus(), next)) {
            throw new BusinessException(ErrorCode.CCER_STATUS_TRANSITION_INVALID,
                    String.format("CCER状态不合法 %s -> %s", p.getStatus(), next));
        }
        p.setStatus(next);
        p.getStatusHistory().add(next);
        return projectRepo.save(p);
    }

    private boolean isValidTransition(CcerProject.Status from, CcerProject.Status to) {
        return switch (from) {
            case DRAFT -> Set.of(CcerProject.Status.SUBMITTED).contains(to);
            case SUBMITTED ->
                    Set.of(CcerProject.Status.UNDER_REVIEW, CcerProject.Status.REJECTED).contains(to);
            case UNDER_REVIEW ->
                    Set.of(CcerProject.Status.RECORDED, CcerProject.Status.REJECTED).contains(to);
            case RECORDED -> Set.of(CcerProject.Status.VALIDATION_PASSED).contains(to);
            case VALIDATION_PASSED -> Set.of(CcerProject.Status.IMPLEMENTING).contains(to);
            case IMPLEMENTING ->
                    Set.of(CcerProject.Status.VERIFICATION_SUBMITTED, CcerProject.Status.SUSPENDED).contains(to);
            case VERIFICATION_SUBMITTED ->
                    Set.of(CcerProject.Status.ISSUED, CcerProject.Status.IMPLEMENTING).contains(to);
            case ISSUED -> Set.of(CcerProject.Status.IMPLEMENTING, CcerProject.Status.SUSPENDED).contains(to);
            case SUSPENDED -> Set.of(CcerProject.Status.IMPLEMENTING).contains(to);
            default -> false;
        };
    }
}

package com.carbon.verification.repository;

import com.carbon.verification.entity.DisclosureReport;
import com.carbon.verification.entity.EvidenceItem;
import com.carbon.verification.entity.VerificationCase;
import com.carbon.verification.entity.VerificationPackage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvidenceItemRepository extends MongoRepository<EvidenceItem, String> {
    List<EvidenceItem> findByTenantIdAndBundleIdOrderByCreatedAtDesc(String tenantId, String bundleId);
    List<EvidenceItem> findByTenantIdAndRefTypeAndRefId(String tenantId, EvidenceItem.RefType refType, String refId);
    Page<EvidenceItem> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);
    long countByTenantIdAndVerificationStatus(String tenantId, String status);
}

@Repository
interface VerificationCaseRepository extends MongoRepository<VerificationCase, String> {
    Page<VerificationCase> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);
    List<VerificationCase> findByTenantIdAndPeriodYear(String tenantId, Integer year);
    Optional<VerificationCase> findByTenantIdAndCaseNumber(String tenantId, String caseNumber);
    long countByTenantIdAndStatus(String tenantId, VerificationCase.Status status);
}

@Repository
interface VerificationPackageRepository extends MongoRepository<VerificationPackage, String> {
    List<VerificationPackage> findByTenantIdAndCaseIdOrderByCreatedAtDesc(String tenantId, String caseId);
    Optional<VerificationPackage> findByTenantIdAndQrCodeToken(String tenantId, String token);
}

@Repository
interface DisclosureReportRepository extends MongoRepository<DisclosureReport, String> {
    Optional<DisclosureReport> findByTenantIdAndPeriodYearAndTemplate(
            String tenantId, Integer year, DisclosureReport.Template template);
    Page<DisclosureReport> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);
    List<DisclosureReport> findByTenantIdAndPeriodYear(String tenantId, Integer year);
}

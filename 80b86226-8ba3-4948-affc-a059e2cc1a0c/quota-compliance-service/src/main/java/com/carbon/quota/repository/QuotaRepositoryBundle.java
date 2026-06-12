package com.carbon.quota.repository;

import com.carbon.quota.entity.CcerTransfer;
import com.carbon.quota.entity.QuotaAllocation;
import com.carbon.quota.entity.QuotaAlert;
import com.carbon.quota.entity.QuotaLedger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuotaAllocationRepository extends MongoRepository<QuotaAllocation, String> {
    Optional<QuotaAllocation> findByTenantIdAndComplianceYearAndOrganizationId(
            String tenantId, Integer year, String orgId);

    List<QuotaAllocation> findByTenantIdAndComplianceYear(String tenantId, Integer year);

    Page<QuotaAllocation> findByTenantIdOrderByComplianceYearDesc(String tenantId, Pageable pageable);
}

@Repository
interface QuotaLedgerRepository extends MongoRepository<QuotaLedger, String> {
    List<QuotaLedger> findByTenantIdAndComplianceYearOrderByMonthAsc(String tenantId, Integer year);

    Optional<QuotaLedger> findByTenantIdAndComplianceYearAndMonthAndOrganizationId(
            String tenantId, Integer year, Integer month, String orgId);

    Page<QuotaLedger> findByTenantIdAndComplianceYearOrderByMonthDesc(String tenantId, Integer year, Pageable pageable);

    @Aggregation(pipeline = {
            "{$match: {'tenantId':?0, 'complianceYear':?1}}",
            "{$group: {_id: null, emission: {$sum:'$cumulativeEmission'}, allocated: {$sum:'$cumulativeAllocated'}, gap: {$sum:'$expectedGap'}}}"
    })
    List<org.bson.Document> summarizeYear(String tenantId, Integer year);
}

@Repository
interface QuotaAlertRepository extends MongoRepository<QuotaAlert, String> {
    Page<QuotaAlert> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    Page<QuotaAlert> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    List<QuotaAlert> findByTenantIdAndLedgerId(String tenantId, String ledgerId);

    long countByTenantIdAndStatus(String tenantId, String status);
}

@Repository
interface CcerTransferRepository extends MongoRepository<CcerTransfer, String> {
    List<CcerTransfer> findByTenantIdAndComplianceYearOrderByTransferDateDesc(String tenantId, Integer year);

    Page<CcerTransfer> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    @Aggregation(pipeline = {
            "{$match: {'tenantId':?0, 'complianceYear':?1, 'status':'APPROVED'}}",
            "{$group: {_id: null, total: {$sum: '$transferTons'}}}"
    })
    List<org.bson.Document> sumUsedCcer(String tenantId, Integer year);
}

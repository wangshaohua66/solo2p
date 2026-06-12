package com.carbon.ccer.repository;

import com.carbon.ccer.entity.CcerIssuance;
import com.carbon.ccer.entity.CcerProject;
import com.carbon.ccer.entity.CcerValidation;
import com.carbon.ccer.entity.CcerVerification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CcerProjectRepository extends MongoRepository<CcerProject, String> {
    Optional<CcerProject> findByTenantIdAndProjectCode(String tenantId, String code);
    Page<CcerProject> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);
    Page<CcerProject> findByTenantIdAndStatus(String tenantId, CcerProject.Status status, Pageable pageable);
    List<CcerProject> findByTenantIdAndProjectType(String tenantId, CcerProject.Type type);
    long countByTenantIdAndStatus(String tenantId, CcerProject.Status status);
}

@Repository
interface CcerValidationRepository extends MongoRepository<CcerValidation, String> {
    Optional<CcerValidation> findFirstByProjectIdOrderByCreatedAtDesc(String projectId);
    List<CcerValidation> findByProjectIdOrderByReportDateDesc(String projectId);
}

@Repository
interface CcerVerificationRepository extends MongoRepository<CcerVerification, String> {
    List<CcerVerification> findByProjectIdOrderByPeriodStartDesc(String projectId);
    Optional<CcerVerification> findByProjectIdAndId(String projectId, String id);
}

@Repository
interface CcerIssuanceRepository extends MongoRepository<CcerIssuance, String> {
    List<CcerIssuance> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<CcerIssuance> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, CcerIssuance.Status status);
    Page<CcerIssuance> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    @Aggregation(pipeline = {
            "{$match:{'tenantId':?0, 'status':{$in:['ISSUED','TRANSFERRED','RETIRED']}}}",
            "{$group:{_id:null, total:{$sum:'$issuedTons'}}}"
    })
    List<org.bson.Document> sumIssued(String tenantId);

    @Aggregation(pipeline = {
            "{$match:{'tenantId':?0, 'status':'ISSUED'}}",
            "{$group:{_id:null, total:{$sum:'$availableTons'}}}"
    })
    List<org.bson.Document> sumAvailable(String tenantId);
}

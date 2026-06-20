package com.notarization.repository;

import com.notarization.model.NotarizationCase;
import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotarizationRepository extends MongoRepository<NotarizationCase, String> {

    Optional<NotarizationCase> findByCaseNumber(String caseNumber);

    Page<NotarizationCase> findByApplicantNameContainingOrApplicantIdCardContainingOrCaseNumberContaining(String name, String idCard, String caseNumber, Pageable pageable);

    Page<NotarizationCase> findByCaseTypeAndStatus(NotarizationType type, CaseStatus status, Pageable pageable);

    Page<NotarizationCase> findByAssignedNotaryIdAndStatus(String notaryId, CaseStatus status, Pageable pageable);

    Page<NotarizationCase> findByAssignedNotaryId(String notaryId, Pageable pageable);

    Page<NotarizationCase> findByStatus(CaseStatus status, Pageable pageable);

    Page<NotarizationCase> findByHallId(HallId hallId, Pageable pageable);

    Long countByCaseTypeAndCreatedAtBetween(NotarizationType type, Instant start, Instant end);

    List<NotarizationCase> findByStatusAndAssignedNotaryIdNullAndCreatedAtBefore(CaseStatus status, Instant createdAt);

    List<NotarizationCase> findTopByCaseNumberStartingWithOrderByCaseNumberDesc(String caseNumberPrefix);

    Long countByStatus(CaseStatus status);

    Optional<NotarizationCase> findByVerificationCode(String code);

    Page<NotarizationCase> findByCaseType(NotarizationType type, Pageable pageable);

    @Aggregation(pipeline = {
        "{ $match: { assignedNotaryId: { $exists: true, $ne: null } } }",
        "{ $group: { _id: '$assignedNotaryId', count: { $sum: 1 } } }",
        "{ $project: { notaryId: '$_id', count: 1, _id: 0 } }",
        "{ $sort: { count: -1 } }"
    })
    List<NotaryWorkloadProjection> aggregateNotaryWorkload();

    interface NotaryWorkloadProjection {
        String getNotaryId();
        Long getCount();
    }
}

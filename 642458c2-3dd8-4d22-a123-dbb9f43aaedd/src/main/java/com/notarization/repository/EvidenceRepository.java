package com.notarization.repository;

import com.notarization.model.EvidenceRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvidenceRepository extends MongoRepository<EvidenceRecord, String> {

    Optional<EvidenceRecord> findByEvidenceNumber(String evidenceNumber);

    List<EvidenceRecord> findByChainIdOrderByHashIndexAsc(String chainId);

    List<EvidenceRecord> findByCaseIdOrderByHashIndexAsc(String caseId);

    Optional<EvidenceRecord> findTopByChainIdOrderByHashIndexDesc(String chainId);

    Long countByChainId(String chainId);

    Page<EvidenceRecord> findBySubmitterId(String submitterId, Pageable pageable);

    Page<EvidenceRecord> findByCaseId(String caseId, Pageable pageable);
}

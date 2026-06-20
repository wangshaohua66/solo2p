package com.notarization.service;

import com.notarization.dto.IntegrityVerifyResult;
import com.notarization.dto.request.EvidenceSubmitRequest;
import com.notarization.model.EvidenceRecord;
import com.notarization.model.HashChain;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface EvidenceHashService {

    EvidenceRecord submitEvidence(EvidenceSubmitRequest req);

    IntegrityVerifyResult verifyIntegrity(String evidenceId);

    HashChain getChain(String chainId);

    Optional<EvidenceRecord> findByEvidenceNumber(String number);

    Page<EvidenceRecord> findByCaseId(String caseId, Pageable pageable);
}

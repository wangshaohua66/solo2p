package com.notarization.repository;

import com.notarization.model.AccessRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AccessRequestRepository extends MongoRepository<AccessRequest, String> {

    Page<AccessRequest> findByToHallIdAndStatus(String hallId, String status, Pageable pageable);

    Page<AccessRequest> findByApplicantId(String applicantId, Pageable pageable);

    Optional<AccessRequest> findByCaseIdAndStatus(String caseId, String status);
}

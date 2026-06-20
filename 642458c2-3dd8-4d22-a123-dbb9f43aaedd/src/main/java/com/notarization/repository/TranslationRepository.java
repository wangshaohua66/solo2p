package com.notarization.repository;

import com.notarization.model.TranslationRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TranslationRepository extends MongoRepository<TranslationRecord, String> {

    List<TranslationRecord> findByCaseId(String caseId);

    Optional<TranslationRecord> findByAssociateId(String associateId);

    List<TranslationRecord> findByAssociateIdOrderByVersionDesc(String associateId);

    Page<TranslationRecord> findByTranslatorIdAndReviewStatus(String translatorId, String status, Pageable pageable);

    Page<TranslationRecord> findByReviewStatus(String status, Pageable pageable);
}

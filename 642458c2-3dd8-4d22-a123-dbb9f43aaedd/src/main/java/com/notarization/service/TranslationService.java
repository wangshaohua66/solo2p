package com.notarization.service;

import com.notarization.dto.request.TranslationSubmitRequest;
import com.notarization.model.TranslationRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface TranslationService {

    TranslationRecord assignTranslationTask(String caseId, String materialId, String sourceLang, String targetLang, String requesterId);

    TranslationRecord submitTranslation(TranslationSubmitRequest req);

    TranslationRecord reviewTranslation(String translationId, String reviewerId, boolean passed, String comment);

    List<TranslationRecord> getByCaseId(String caseId);

    List<TranslationRecord> getVersionHistory(String associateId);

    Page<TranslationRecord> getPendingReviews(Pageable pageable);
}

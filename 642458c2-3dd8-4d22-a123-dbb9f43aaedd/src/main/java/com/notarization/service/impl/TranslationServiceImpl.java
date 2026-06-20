package com.notarization.service.impl;

import com.notarization.dto.request.TranslationSubmitRequest;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.TranslationRecord;
import com.notarization.repository.TranslationRepository;
import com.notarization.service.TranslationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TranslationServiceImpl implements TranslationService {

    private final TranslationRepository translationRepository;

    @Override
    public TranslationRecord assignTranslationTask(String caseId, String materialId, String sourceLang, String targetLang, String requesterId) {
        String associateId = caseId + materialId;
        String language = sourceLang + "->" + targetLang;

        TranslationRecord.Trace trace = TranslationRecord.Trace.builder()
                .userId(requesterId)
                .action("任务创建")
                .timestamp(Instant.now())
                .detail("创建翻译任务，语言对：" + language)
                .build();

        List<TranslationRecord.Trace> traces = new ArrayList<>();
        traces.add(trace);

        TranslationRecord record = TranslationRecord.builder()
                .id(generateUUID())
                .caseId(caseId)
                .associateId(associateId)
                .materialId(materialId)
                .translatorId(null)
                .language(language)
                .version(1)
                .translationUrl(null)
                .translationHash(null)
                .reviewedBy(null)
                .reviewStatus("PENDING_TRANSLATION")
                .modificationTraces(traces)
                .createdAt(Instant.now())
                .build();

        return translationRepository.save(record);
    }

    @Override
    public TranslationRecord submitTranslation(TranslationSubmitRequest req) {
        String associateId = req.getCaseId() + req.getLanguage();
        TranslationRecord record = translationRepository.findByAssociateId(associateId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TRANSLATION_NOT_FOUND));

        String hash = sha256(req.getTranslationUrl() + record.getVersion());

        TranslationRecord.Trace trace = TranslationRecord.Trace.builder()
                .userId(req.getTranslatorId())
                .action("翻译提交")
                .timestamp(Instant.now())
                .detail("提交翻译文档，URL：" + req.getTranslationUrl())
                .build();

        record.setTranslatorId(req.getTranslatorId());
        record.setTranslationUrl(req.getTranslationUrl());
        record.setTranslationHash(hash);
        record.setReviewStatus("PENDING_REVIEW");
        record.getModificationTraces().add(trace);

        return translationRepository.save(record);
    }

    @Override
    public TranslationRecord reviewTranslation(String translationId, String reviewerId, boolean passed, String comment) {
        TranslationRecord record = translationRepository.findById(translationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TRANSLATION_NOT_FOUND));

        TranslationRecord.Trace trace = TranslationRecord.Trace.builder()
                .userId(reviewerId)
                .action(passed ? "翻译审核通过" : "翻译审核驳回")
                .timestamp(Instant.now())
                .detail(comment)
                .build();

        if (passed) {
            record.setReviewStatus("APPROVED");
        } else {
            record.setReviewStatus("REJECTED");
        }
        record.setReviewedBy(reviewerId);
        record.getModificationTraces().add(trace);

        return translationRepository.save(record);
    }

    @Override
    public List<TranslationRecord> getByCaseId(String caseId) {
        return translationRepository.findByCaseId(caseId);
    }

    @Override
    public List<TranslationRecord> getVersionHistory(String associateId) {
        return translationRepository.findByAssociateIdOrderByVersionDesc(associateId);
    }

    @Override
    public Page<TranslationRecord> getPendingReviews(Pageable pageable) {
        return translationRepository.findByReviewStatus("PENDING_REVIEW", pageable);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not found", e);
            throw new BusinessException(ErrorCode.PARAM_INVALID, "哈希算法不可用");
        }
    }

    private String generateUUID() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}

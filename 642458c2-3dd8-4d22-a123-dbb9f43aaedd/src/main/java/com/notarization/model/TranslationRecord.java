package com.notarization.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "translation_records")
public class TranslationRecord {

    @Id
    private String id;

    @Indexed
    private String caseId;

    private String associateId;

    private String materialId;

    @Indexed
    private String translatorId;

    private String language;

    private Integer version;

    private String translationUrl;

    private String translationHash;

    private String reviewedBy;

    private String reviewStatus;

    private List<Trace> modificationTraces;

    @Indexed
    private Instant createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Trace {
        private String userId;
        private String action;
        private Instant timestamp;
        private String detail;
    }
}

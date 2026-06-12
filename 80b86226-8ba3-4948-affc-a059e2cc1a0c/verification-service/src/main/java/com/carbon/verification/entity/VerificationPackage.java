package com.carbon.verification.entity;

import com.carbon.common.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "verification_packages")
@CompoundIndex(name = "tenant_case_idx", def = "{'tenantId':1, 'caseId':1}")
public class VerificationPackage extends BaseEntity {

    @Indexed
    private String caseId;

    private String packageName;

    @Builder.Default
    private List<PackageSection> sections = new ArrayList<>();

    @Builder.Default
    private List<String> evidenceItemIds = new ArrayList<>();

    private Integer itemCount;

    private Long totalSize;

    private String indexFileId;

    private String pdfFileId;

    private String pdfHash;

    private Instant generatedAt;

    private String generatedBy;

    private String qrCodeToken;

    @Builder.Default
    private List<SignRecord> signRecords = new ArrayList<>();

    @Builder.Default
    private String status = "DRAFT";

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PackageSection {
        private String id;
        private String title;
        private String description;
        @Builder.Default
        private List<String> itemIds = new ArrayList<>();
        private Integer order;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignRecord {
        private String verifierId;
        private String verifierName;
        private String credentialNo;
        private String signature;
        private String sealImageId;
        private String location;
        private Instant signedAt;
        private String deviceInfo;
        private String clientIp;
    }
}

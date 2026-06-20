package com.notarization.model;

import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import com.notarization.model.enums.WorkflowAction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "notarization_cases")
public class NotarizationCase {

    @Id
    private String id;

    @TextIndexed
    @Indexed(unique = true)
    private String caseNumber;

    @Indexed
    private NotarizationType caseType;

    @TextIndexed
    private String applicantName;

    @TextIndexed
    private String applicantIdCard;

    private String contactPhone;

    private List<Material> materials;

    @Indexed
    private CaseStatus status;

    @Indexed
    private HallId hallId;

    private String assignedNotaryId;

    private String assignedReviewerId;

    private Boolean urgent;

    private List<WorkflowRecord> workflowHistory;

    private List<ApprovalRecord> approvalRecords;

    private String verificationCode;

    private String certificateUrl;

    private AccessControl accessControl;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @CreatedBy
    private String createdBy;

    @Version
    private Long version;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Material {
        private String id;
        private String name;
        private String url;
        private String type;
        private Long size;
        private String hash;
        private Instant uploadTime;
        private String uploaderId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkflowRecord {
        private CaseStatus statusFrom;
        private CaseStatus statusTo;
        private String operatorId;
        private String operatorName;
        private WorkflowAction action;
        private String opinion;
        private Instant timestamp;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApprovalRecord {
        private String reviewerId;
        private String reviewerName;
        private String opinion;
        private Boolean approved;
        private Instant timestamp;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AccessControl {
        private List<String> allowedUserIds;
        private Boolean isRestricted;
    }
}

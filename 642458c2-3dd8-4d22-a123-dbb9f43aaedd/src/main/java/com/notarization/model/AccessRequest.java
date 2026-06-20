package com.notarization.model;

import com.notarization.model.enums.HallId;
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
@Document(collection = "access_requests")
public class AccessRequest {

    @Id
    private String id;

    @Indexed
    private String caseId;

    private HallId fromHallId;

    private HallId toHallId;

    @Indexed
    private String applicantId;

    private String approverId;

    private String reason;

    @Indexed
    private Status status;

    @Indexed
    private Instant requestTime;

    private Instant approveTime;

    private List<AuditEntry> auditLog;

    public enum Status {
        Pending,
        Approved,
        Rejected
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditEntry {
        private String userId;
        private String action;
        private Instant timestamp;
        private String ip;
    }
}

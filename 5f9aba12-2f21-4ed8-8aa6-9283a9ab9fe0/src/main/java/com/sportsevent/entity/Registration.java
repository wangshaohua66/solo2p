package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "registrations")
@CompoundIndex(name = "idx_reg_league_team", def = "{'leagueId': 1, 'teamId': 1}", unique = true)
public class Registration {

    @Id
    private String id;

    private String leagueId;

    private String teamId;

    private List<String> athleteIds;

    private String category;

    private RegistrationStatus status;

    private List<EligibilityIssue> eligibilityIssues;

    private List<MultiSportConflict> multiSportConflicts;

    private LocalDateTime submittedAt;

    private LocalDateTime reviewedAt;

    private String reviewedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum RegistrationStatus {
        SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
    }

    @Data
    public static class EligibilityIssue {
        private IssueType type;
        private String athleteId;
        private String description;
        private IssueSeverity severity;

        public enum IssueType {
            AGE_MISMATCH, REGISTRATION_EXPIRED, SUSPENDED, MULTISPORT_LIMIT_EXCEEDED, CATEGORY_MISMATCH
        }

        public enum IssueSeverity {
            WARNING, ERROR
        }
    }

    @Data
    public static class MultiSportConflict {
        private String athleteId;
        private String conflictingLeagueId;
        private String matchId;
        private LocalDateTime conflictTime;
    }
}

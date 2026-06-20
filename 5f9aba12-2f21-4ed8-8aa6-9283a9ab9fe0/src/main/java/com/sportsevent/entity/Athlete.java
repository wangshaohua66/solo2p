package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "athletes")
public class Athlete {

    @Id
    private String id;

    @Indexed(unique = true)
    private String idCardNumber;

    @Indexed
    private String name;

    private String gender;

    private LocalDate birthDate;

    private String phone;

    private String email;

    private String organization;

    private LocalDate registrationDate;

    private LocalDate registrationExpiry;

    private List<SuspensionRecord> suspensionRecords;

    private List<LeagueParticipation> participationHistory;

    private AthleteStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum AthleteStatus {
        ACTIVE, EXPIRED, SUSPENDED, CANCELLED
    }

    @Data
    public static class SuspensionRecord {
        private String reason;
        private LocalDate startDate;
        private LocalDate endDate;
        private String leagueId;
        private SuspensionStatus status;

        public enum SuspensionStatus {
            ACTIVE, EXPIRED, APPEALED
        }
    }

    @Data
    public static class LeagueParticipation {
        private String leagueId;
        private String teamId;
        private LocalDate joinDate;
        private String finalRank;
    }
}

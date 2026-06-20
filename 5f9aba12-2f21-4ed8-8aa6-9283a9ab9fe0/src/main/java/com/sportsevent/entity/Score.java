package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "scores")
public class Score {

    @Id
    private String id;

    @Indexed
    private String matchId;

    private String leagueId;

    private String teamAId;

    private String teamBId;

    private Integer teamAScore;

    private Integer teamBScore;

    private List<SetScore> setScores;

    private ScoreStatus status;

    private boolean appealed;

    private AppealRecord appealRecord;

    private LocalDateTime recordedAt;

    private String recordedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum ScoreStatus {
        DRAFT, CONFIRMED, APPEALED, OVERRULED
    }

    @Data
    public static class SetScore {
        private Integer setNumber;
        private Integer teamAScore;
        private Integer teamBScore;
    }

    @Data
    public static class AppealRecord {
        private String reason;
        private LocalDateTime appealedAt;
        private String appealedBy;
        private AppealDecision decision;
        private LocalDateTime decidedAt;
        private String decidedBy;
        private String decisionNote;

        public enum AppealDecision {
            UPHELD, REJECTED, PARTIAL
        }
    }
}

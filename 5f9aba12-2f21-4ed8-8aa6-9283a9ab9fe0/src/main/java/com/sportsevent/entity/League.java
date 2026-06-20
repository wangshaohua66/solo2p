package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "leagues")
@CompoundIndex(name = "idx_league_season_sport", def = "{'year': 1, 'sportType': 1, 'category': 1}", unique = true)
public class League {

    @Id
    private String id;

    private String name;

    private SportType sportType;

    private String category;

    private Integer year;

    private SeasonPhase phase;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    private List<String> groupNames;

    private List<String> venueIds;

    private ScoringRule scoringRule;

    private LeagueStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum SportType {
        BASKETBALL, SOCCER, BADMINTON, TABLE_TENNIS, TENNIS
    }

    public enum SeasonPhase {
        PREPARATION, REGISTRATION, GROUP_STAGE, KNOCKOUT_STAGE, FINISHED
    }

    public enum LeagueStatus {
        DRAFT, PUBLISHED, CANCELLED
    }

    @Data
    public static class ScoringRule {
        private Integer winPoints;
        private Integer drawPoints;
        private Integer losePoints;
        private boolean useGoalDifference;
        private boolean useHeadToHead;
    }
}

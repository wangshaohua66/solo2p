package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "matches")
@CompoundIndex(name = "idx_match_league_start", def = "{'leagueId': 1, 'startTime': 1}")
@CompoundIndex(name = "idx_match_venue_time", def = "{'venueId': 1, 'courtNumber': 1, 'startTime': 1}")
public class Match {

    @Id
    private String id;

    private String leagueId;

    private String groupName;

    private StageType stage;

    private Integer round;

    private String teamAId;

    private String teamBId;

    private String venueId;

    private Integer courtNumber;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private MatchStatus status;

    private List<String> refereeIds;

    private String scoreId;

    private Integer restMinutesBefore;

    private List<ConflictWarning> conflicts;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum StageType {
        GROUP_STAGE, ROUND_OF_32, ROUND_OF_16, QUARTER_FINAL, SEMI_FINAL, THIRD_PLACE, FINAL
    }

    public enum MatchStatus {
        SCHEDULED, IN_PROGRESS, FINISHED, CANCELLED, POSTPONED, APPEAL_UPHELD
    }

    @Data
    public static class ConflictWarning {
        private ConflictType type;
        private String description;
        private String relatedEntityId;

        public enum ConflictType {
            VENUE_CONFLICT, TEAM_CONFLICT, REFEREE_CONFLICT, ATHLETE_MULTISPORT_CONFLICT
        }
    }
}

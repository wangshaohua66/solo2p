package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "knockout_brackets")
@CompoundIndex(name = "idx_bracket_league_stage", def = "{'leagueId': 1, 'stage': 1}")
public class KnockoutBracket {

    @Id
    private String id;

    private String leagueId;

    private Match.StageType stage;

    private List<BracketNode> nodes;

    private BracketStatus status;

    private LocalDateTime generatedAt;

    private LocalDateTime updatedAt;

    public enum BracketStatus {
        GENERATED, IN_PROGRESS, COMPLETED
    }

    @Data
    public static class BracketNode {
        private String nodeId;
        private Integer position;
        private String teamId;
        private String teamName;
        private String matchId;
        private String parentNodeId;
        private String sourceRankingNote;
        private boolean isBye;
        private BracketNodeStatus status;

        public enum BracketNodeStatus {
            PENDING, CONFIRMED, WON, LOST
        }
    }
}

package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "rankings")
@CompoundIndex(name = "idx_ranking_league_group_team", def = "{'leagueId': 1, 'groupName': 1, 'teamId': 1}", unique = true)
public class Ranking {

    @Id
    private String id;

    private String leagueId;

    private String groupName;

    private String teamId;

    private Integer position;

    private Integer played;

    private Integer won;

    private Integer drawn;

    private Integer lost;

    private Integer goalsFor;

    private Integer goalsAgainst;

    private Integer goalDifference;

    private Integer points;

    private String headToHeadNote;

    private QualificationStatus qualificationStatus;

    private LocalDateTime lastCalculatedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum QualificationStatus {
        QUALIFIED, ELIMINATED, PENDING
    }
}

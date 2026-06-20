package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "group_definitions")
@CompoundIndex(name = "idx_group_league_name", def = "{'leagueId': 1, 'name': 1}", unique = true)
public class GroupDefinition {

    @Id
    private String id;

    private String leagueId;

    private String name;

    private String category;

    private AgeRange ageRange;

    private SkillLevel minLevel;

    private SkillLevel maxLevel;

    private Integer maxTeams;

    private String description;

    private Integer displayOrder;

    private GroupStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum SkillLevel {
        BEGINNER, INTERMEDIATE, ADVANCED, ELITE
    }

    public enum GroupStatus {
        ACTIVE, INACTIVE, FULL
    }

    @Data
    public static class AgeRange {
        private Integer minAge;
        private Integer maxAge;
    }
}

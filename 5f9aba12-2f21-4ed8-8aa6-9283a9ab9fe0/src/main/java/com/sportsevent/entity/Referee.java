package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "referees")
public class Referee {

    @Id
    private String id;

    @Indexed
    private String name;

    private String idCardNumber;

    private String phone;

    private String email;

    private String organization;

    private List<League.SportType> certifiedSports;

    private List<String> certifiedCategories;

    private RefereeLevel level;

    private List<AvoidanceRelation> avoidanceRelations;

    private Integer totalMatchesAssigned;

    private RefereeStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum RefereeLevel {
        NATIONAL, PROVINCIAL, CITY, DISTRICT
    }

    public enum RefereeStatus {
        ACTIVE, INACTIVE, SUSPENDED
    }

    @Data
    public static class AvoidanceRelation {
        private AvoidanceType type;
        private String relatedEntityId;
        private String relatedEntityName;

        public enum AvoidanceType {
            SAME_ORGANIZATION, FAMILY_RELATION, COACH_RELATION, OTHER
        }
    }
}

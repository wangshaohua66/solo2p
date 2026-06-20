package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "teams")
public class Team {

    @Id
    private String id;

    @Indexed
    private String name;

    private League.SportType sportType;

    private String category;

    private String leaderName;

    private String leaderPhone;

    private List<String> athleteIds;

    private TeamStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum TeamStatus {
        ACTIVE, INACTIVE, DISQUALIFIED
    }
}

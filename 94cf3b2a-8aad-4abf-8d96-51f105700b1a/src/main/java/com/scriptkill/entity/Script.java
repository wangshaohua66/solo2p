package com.scriptkill.entity;

import com.scriptkill.entity.enums.ScriptDifficulty;
import com.scriptkill.entity.enums.ScriptGenre;
import com.scriptkill.entity.enums.VisibilityLevel;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "scripts", indexes = {
    @Index(name = "idx_script_name", columnList = "name"),
    @Index(name = "idx_genre", columnList = "genre"),
    @Index(name = "idx_difficulty", columnList = "difficulty"),
    @Index(name = "idx_status", columnList = "status")
})
public class Script {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "min_players", nullable = false)
    private Integer minPlayers;

    @Column(name = "max_players", nullable = false)
    private Integer maxPlayers;

    @Column(name = "estimated_duration_minutes", nullable = false)
    private Integer estimatedDurationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScriptGenre genre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScriptDifficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_level", nullable = false, length = 20)
    private VisibilityLevel visibilityLevel = VisibilityLevel.PUBLIC;

    @Column(name = "version")
    private Integer version = 1;

    @Column(name = "version_snapshot")
    private String versionSnapshot;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Column(name = "background_story", columnDefinition = "TEXT")
    private String backgroundStory;

    @Column(name = "ending_count")
    private Integer endingCount = 1;

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(name = "total_played_count")
    private Integer totalPlayedCount = 0;

    @Column(name = "average_rating")
    private Double averageRating = 0.0;

    @OneToMany(mappedBy = "script", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ScriptCharacter> characters = new ArrayList<>();

    @OneToMany(mappedBy = "script", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Stage> stages = new ArrayList<>();

    @OneToMany(mappedBy = "script", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Clue> clues = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

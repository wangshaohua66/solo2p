package com.scriptkill.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "reviews", indexes = {
    @Index(name = "idx_review_session", columnList = "session_id"),
    @Index(name = "idx_review_script", columnList = "script_id"),
    @Index(name = "idx_review_player", columnList = "player_id")
})
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private GameSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "script_id", nullable = false)
    private Script script;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id", nullable = false)
    private User player;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "character_id")
    private ScriptCharacter character;

    @Column(name = "script_rating", nullable = false)
    private Integer scriptRating;

    @Column(name = "dm_professionalism", nullable = false)
    private Integer dmProfessionalism;

    @Column(name = "character_fit", nullable = false)
    private Integer characterFit;

    @Column(name = "overall_experience", nullable = false)
    private Integer overallExperience;

    @Column(name = "story_rating")
    private Integer storyRating;

    @Column(name = "puzzle_difficulty_rating")
    private Integer puzzleDifficultyRating;

    @Column(name = "atmosphere_rating")
    private Integer atmosphereRating;

    @Column(name = "is_anonymous", nullable = false)
    private Boolean isAnonymous = true;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "suggestions", columnDefinition = "TEXT")
    private String suggestions;

    @Column(name = "would_recommend")
    private Boolean wouldRecommend;

    @Column(name = "emotional_tags", length = 200)
    private String emotionalTags;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

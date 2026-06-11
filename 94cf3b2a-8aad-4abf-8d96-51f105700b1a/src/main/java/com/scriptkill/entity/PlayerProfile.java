package com.scriptkill.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "players", indexes = {
    @Index(name = "idx_player_user", columnList = "user_id"),
    @Index(name = "idx_player_user_unique", columnList = "user_id", unique = true),
    @Index(name = "idx_player_preference", columnList = "preferred_genre"),
    @Index(name = "idx_player_age_group", columnList = "age_group")
})
public class PlayerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "real_name", length = 50)
    private String realName;

    @Column(name = "age_group", length = 20)
    private String ageGroup;

    @Column(length = 10)
    private String gender;

    @Column(name = "preferred_genre", length = 100)
    private String preferredGenre;

    @Column(name = "play_count")
    private Integer playCount = 0;

    @Column(name = "average_rating")
    private Double averageRating = 0.0;

    @Column(name = "history_score")
    private Integer historyScore = 0;

    @Column(name = "preference_tags", length = 500)
    private String preferenceTags;

    @Column(name = "horror_tolerance")
    private Integer horrorTolerance = 5;

    @Column(name = "emotional_sensitivity")
    private Integer emotionalSensitivity = 5;

    @Column(name = "reasoning_ability")
    private Integer reasoningAbility = 5;

    @Column(name = "social_level")
    private Integer socialLevel = 5;

    @Column(name = "birthday")
    private LocalDate birthday;

    @Column(name = "member_level", length = 20)
    private String memberLevel = "NORMAL";

    @Column(name = "total_spent")
    private Integer totalSpent = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

package com.scriptkill.entity;

import com.scriptkill.entity.enums.VisibilityLevel;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "characters", indexes = {
    @Index(name = "idx_character_script", columnList = "script_id"),
    @Index(name = "idx_character_gender", columnList = "gender")
})
public class ScriptCharacter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "script_id", nullable = false)
    private Script script;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 10)
    private String gender;

    @Column(name = "age_range", length = 20)
    private String ageRange;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "character_story", columnDefinition = "TEXT")
    private String characterStory;

    @Column(name = "secret_info", columnDefinition = "TEXT")
    private String secretInfo;

    @Column(name = "character_trait", length = 200)
    private String characterTrait;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_level", nullable = false, length = 20)
    private VisibilityLevel visibilityLevel = VisibilityLevel.PUBLIC;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "is_killer")
    private Boolean isKiller = false;

    @Column(name = "avatar_url")
    private String avatarUrl;
}

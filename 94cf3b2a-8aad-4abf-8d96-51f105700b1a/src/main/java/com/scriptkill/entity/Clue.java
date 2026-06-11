package com.scriptkill.entity;

import com.scriptkill.entity.enums.ClueTriggerType;
import com.scriptkill.entity.enums.VisibilityLevel;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "clues", indexes = {
    @Index(name = "idx_clue_script", columnList = "script_id"),
    @Index(name = "idx_clue_stage", columnList = "stage_id"),
    @Index(name = "idx_clue_character", columnList = "character_id"),
    @Index(name = "idx_trigger_type", columnList = "trigger_type")
})
public class Clue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "script_id", nullable = false)
    private Script script;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stage_id")
    private Stage stage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "character_id")
    private ScriptCharacter character;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "clue_level", nullable = false)
    private Integer clueLevel = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 20)
    private ClueTriggerType triggerType;

    @Column(name = "trigger_condition", length = 500)
    private String triggerCondition;

    @Column(name = "trigger_time_minutes")
    private Integer triggerTimeMinutes;

    @Column(name = "trigger_location", length = 100)
    private String triggerLocation;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_level", nullable = false, length = 20)
    private VisibilityLevel visibilityLevel = VisibilityLevel.DM_ONLY;

    @Column(name = "is_key_clue")
    private Boolean isKeyClue = false;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "dm_note", columnDefinition = "TEXT")
    private String dmNote;
}

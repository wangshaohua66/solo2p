package com.scriptkill.entity;

import com.scriptkill.entity.enums.VisibilityLevel;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "stages", indexes = {
    @Index(name = "idx_stage_script", columnList = "script_id"),
    @Index(name = "idx_stage_order", columnList = "stage_order")
})
public class Stage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "script_id", nullable = false)
    private Script script;

    @Column(name = "stage_order", nullable = false)
    private Integer stageOrder;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "stage_goal", length = 500)
    private String stageGoal;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_level", nullable = false, length = 20)
    private VisibilityLevel visibilityLevel = VisibilityLevel.PUBLIC;

    @Column(name = "dm_hint", columnDefinition = "TEXT")
    private String dmHint;

    @Column(name = "event_trigger", length = 200)
    private String eventTrigger;
}

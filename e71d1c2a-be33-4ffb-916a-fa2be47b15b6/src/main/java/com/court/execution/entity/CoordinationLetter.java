package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "coordination_letter")
public class CoordinationLetter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String letterNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private ExecutionCase executionCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false)
    private CoordinationUnit coordinationUnit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PropertyType propertyType;

    @Column(length = 20)
    private String letterType;

    @Column(columnDefinition = "TEXT")
    private String letterContent;

    @Column(length = 20)
    private String status;

    private LocalDateTime sendTime;

    private LocalDateTime feedbackTime;

    @Column(columnDefinition = "TEXT")
    private String feedbackContent;

    @Column(nullable = false)
    private Boolean reminderSent = false;

    private LocalDateTime reminderTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id")
    private User creator;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

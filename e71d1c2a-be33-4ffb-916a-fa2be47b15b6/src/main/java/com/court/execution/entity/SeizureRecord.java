package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "seizure_record")
public class SeizureRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private ExecutionCase executionCase;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SeizureType seizureType;

    @Column(length = 100)
    private String seizureDocumentNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coordination_unit_id")
    private CoordinationUnit coordinationUnit;

    @Column(nullable = false)
    private LocalDateTime startDate;

    @Column(nullable = false)
    private LocalDateTime endDate;

    @Column(nullable = false)
    private Boolean expired = false;

    @Column(nullable = false)
    private Boolean warningSent = false;

    private LocalDateTime releaseDate;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operator_id")
    private User operator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    private User approver;

    @Column(length = 20)
    private String approvalStatus;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

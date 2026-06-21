package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "execution_case")
public class ExecutionCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String caseNumber;

    @Column(nullable = false, length = 100)
    private String caseName;

    @Column(length = 200)
    private String executionBasis;

    @Column(precision = 15, scale = 2)
    private BigDecimal executionAmount;

    @Column(nullable = false, length = 100)
    private String debtorName;

    @Column(length = 50)
    private String debtorIdCard;

    @Column(length = 100)
    private String debtorAddress;

    @Column(length = 20)
    private String debtorPhone;

    @Column(length = 100)
    private String creditorName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "judge_id")
    private User judge;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assistant_id")
    private User assistant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CaseStatus status;

    @Column(columnDefinition = "TEXT")
    private String remark;

    private LocalDateTime filingDate;

    private LocalDateTime closeDate;

    @Column(precision = 15, scale = 2)
    private BigDecimal realizedAmount;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

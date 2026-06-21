package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "distribution_plan")
public class DistributionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private ExecutionCase executionCase;

    @Column(nullable = false, length = 50)
    private String planNumber;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(precision = 15, scale = 2)
    private BigDecimal executionFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal litigationFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal evaluationFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal auctionFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal distributableAmount;

    @Column(length = 20)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id")
    private User creator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    private User approver;

    private LocalDateTime approvalTime;

    private LocalDateTime distributeTime;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @OneToMany(mappedBy = "distributionPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DistributionDetail> details = new ArrayList<>();

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "distribution_detail")
public class DistributionDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private DistributionPlan distributionPlan;

    @Column(nullable = false)
    private Integer priorityOrder;

    @Column(nullable = false, length = 50)
    private String creditorType;

    @Column(nullable = false, length = 100)
    private String creditorName;

    @Column(length = 50)
    private String creditorIdCard;

    @Column(precision = 15, scale = 2)
    private BigDecimal claimAmount;

    @Column(precision = 15, scale = 2)
    private BigDecimal distributableAmount;

    @Column(precision = 15, scale = 2)
    private BigDecimal actualAmount;

    @Column(length = 100)
    private String bankName;

    @Column(length = 50)
    private String bankAccount;

    @Column(length = 20)
    private String payStatus;

    private LocalDateTime payTime;

    @Column(length = 100)
    private String voucherNumber;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "auction")
public class Auction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private ExecutionCase executionCase;

    @Column(nullable = false, length = 200)
    private String auctionTitle;

    @Column(length = 100)
    private String evaluationAgency;

    @Column(precision = 15, scale = 2)
    private BigDecimal evaluationPrice;

    private LocalDateTime evaluationDate;

    @Column(length = 500)
    private String evaluationReportUrl;

    @Column(length = 100)
    private String auctionPlatform;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuctionStatus status;

    @Column(precision = 15, scale = 2)
    private BigDecimal startingPrice;

    @Column(precision = 15, scale = 2)
    private BigDecimal reservePrice;

    @Column(precision = 15, scale = 2)
    private BigDecimal bidIncrement;

    private LocalDateTime announceTime;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    @Column(precision = 15, scale = 2)
    private BigDecimal finalPrice;

    @Column(length = 100)
    private String buyerName;

    @Column(length = 50)
    private String buyerIdCard;

    @Column(length = 20)
    private String buyerPhone;

    private LocalDateTime dealTime;

    @Column(length = 100)
    private String dealDocumentNumber;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_specialist_id")
    private User auctionSpecialist;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

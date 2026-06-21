package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "bid_record")
public class BidRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", nullable = false)
    private Auction auction;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal bidAmount;

    @Column(length = 100)
    private String bidderName;

    @Column(length = 50)
    private String bidderIdCard;

    @Column(length = 20)
    private String bidderPhone;

    @CreationTimestamp
    @Column(nullable = false)
    private LocalDateTime bidTime;

    @Column(columnDefinition = "TEXT")
    private String remark;
}

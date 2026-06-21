package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "property")
public class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private ExecutionCase executionCase;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PropertyType propertyType;

    @Column(nullable = false, length = 200)
    private String propertyName;

    @Column(columnDefinition = "TEXT")
    private String propertyDescription;

    @Column(precision = 15, scale = 2)
    private BigDecimal estimatedValue;

    @Column(length = 100)
    private String propertyLocation;

    @Column(length = 100)
    private String certificateNumber;

    @Column(nullable = false)
    private Boolean seized = false;

    private LocalDateTime seizeDate;

    private LocalDateTime seizeExpireDate;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private PropertyDisposalStatus disposalStatus = PropertyDisposalStatus.NOT_DISPOSED;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

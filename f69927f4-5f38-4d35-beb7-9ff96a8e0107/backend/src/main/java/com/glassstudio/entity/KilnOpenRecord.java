package com.glassstudio.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "kiln_open_records")
public class KilnOpenRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long kilnId;

    private Long scheduleId;

    @Column(nullable = false)
    private Long operatorId;

    @Column(nullable = false)
    private LocalDateTime openTime;

    @Column(precision = 10, scale = 2)
    private BigDecimal temperatureAtOpen;

    @Column(nullable = false)
    private Boolean isViolation;

    @Column(length = 500)
    private String note;
}

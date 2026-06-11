package com.glassstudio.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "cost_records")
public class CostRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long scheduleId;

    @Column(precision = 12, scale = 2)
    private BigDecimal electricityCost;

    @Column(precision = 12, scale = 2)
    private BigDecimal materialCost;

    @Column(precision = 12, scale = 2)
    private BigDecimal laborCost;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalCost;

    @Column(precision = 12, scale = 2)
    private BigDecimal costPerWorkpiece;
}

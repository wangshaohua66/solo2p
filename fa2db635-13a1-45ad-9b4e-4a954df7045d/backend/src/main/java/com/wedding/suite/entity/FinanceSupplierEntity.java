package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "finance_supplier")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FinanceSupplierEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "finance_id", nullable = false)
    private Long financeId;
    @Column(nullable = false, length = 64)
    private String name;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(nullable = false)
    private Boolean settled;
}

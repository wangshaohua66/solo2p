package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "finance")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FinanceEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "wedding_id", nullable = false)
    private Long weddingId;
    @Column(name = "couple_name", nullable = false, length = 64)
    private String coupleName;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal income;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal received;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cost;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal paid;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal profit;

    @OneToMany(mappedBy = "financeId", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<FinanceSupplierEntity> suppliers = new ArrayList<>();
}

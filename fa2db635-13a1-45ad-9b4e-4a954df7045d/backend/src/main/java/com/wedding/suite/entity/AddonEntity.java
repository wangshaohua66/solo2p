package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "addon")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AddonEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 64)
    private String name;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cost;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;
    @Column(nullable = false, length = 16)
    private String unit;
}

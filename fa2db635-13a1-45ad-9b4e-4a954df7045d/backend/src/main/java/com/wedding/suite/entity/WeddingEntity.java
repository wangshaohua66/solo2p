package com.wedding.suite.entity;

import com.wedding.suite.enums.WeddingStage;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "wedding")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WeddingEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "couple_name", nullable = false, length = 64)
    private String coupleName;
    @Column(name = "groom_name", length = 32)
    private String groomName;
    @Column(name = "bride_name", length = 32)
    private String brideName;
    @Column(nullable = false, length = 20)
    private String phone;
    @Column(name = "wedding_date", nullable = false)
    private LocalDate weddingDate;
    @Column(nullable = false)
    private Integer guests;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private WeddingStage stage;
    @Column(name = "store_id", nullable = false)
    private Long storeId;
    @Column(name = "planner_id")
    private Long plannerId;
    @Column(name = "package_id", nullable = false)
    private Long packageId;
    @Column(name = "quote_total", precision = 12, scale = 2)
    private BigDecimal quoteTotal;
    @Column(nullable = false)
    private Integer progress;
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}

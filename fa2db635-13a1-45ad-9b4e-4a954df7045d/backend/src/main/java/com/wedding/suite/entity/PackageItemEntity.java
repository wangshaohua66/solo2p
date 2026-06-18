package com.wedding.suite.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.wedding.suite.enums.PackageItemType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "package_item")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PackageItemEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_id", nullable = false)
    @JsonIgnore
    private PackageEntity pkg;
    @Column(nullable = false, length = 64)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PackageItemType type;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cost;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;
    @Column(nullable = false)
    private Boolean included;
}

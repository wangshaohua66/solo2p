package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "package")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PackageEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 64)
    private String name;
    @Column(name = "base_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePrice;
    @Column(length = 255)
    private String description;

    @OneToMany(mappedBy = "pkg", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id asc")
    @Builder.Default
    private List<PackageItemEntity> items = new ArrayList<>();
}

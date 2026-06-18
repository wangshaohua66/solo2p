package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "prop")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PropEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "store_id", nullable = false)
    private Long storeId;
    @Column(nullable = false, length = 64)
    private String name;
    @Column(nullable = false)
    private Integer stock;
}

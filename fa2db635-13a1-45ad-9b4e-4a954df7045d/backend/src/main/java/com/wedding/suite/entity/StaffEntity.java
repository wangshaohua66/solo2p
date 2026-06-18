package com.wedding.suite.entity;

import com.wedding.suite.enums.StaffRole;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "staff")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StaffEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "store_id", nullable = false)
    private Long storeId;
    @Column(nullable = false, length = 32)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StaffRole role;
    @Column(nullable = false, length = 20)
    private String phone;
    @Column(length = 255)
    private String avatar;
}

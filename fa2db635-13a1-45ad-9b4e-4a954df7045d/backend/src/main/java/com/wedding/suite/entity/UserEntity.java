package com.wedding.suite.entity;

import com.wedding.suite.enums.UserRole;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 32)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;
    @Column(name = "store_id")
    private Long storeId;
    @Column(length = 20)
    private String phone;
    @Column(nullable = false, length = 255)
    private String password;
    @Column(length = 255)
    private String avatar;
}

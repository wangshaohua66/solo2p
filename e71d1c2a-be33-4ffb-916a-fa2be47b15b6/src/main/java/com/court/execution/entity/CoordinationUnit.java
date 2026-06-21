package com.court.execution.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "coordination_unit")
public class CoordinationUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String unitName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PropertyType propertyType;

    @Column(length = 200)
    private String address;

    @Column(length = 20)
    private String contactPerson;

    @Column(length = 20)
    private String contactPhone;

    @Column(length = 100)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @Column(nullable = false)
    private Boolean enabled = true;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}

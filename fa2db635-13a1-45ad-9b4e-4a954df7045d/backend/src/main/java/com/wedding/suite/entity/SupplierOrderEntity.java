package com.wedding.suite.entity;

import com.wedding.suite.enums.ScheduleStatus;
import com.wedding.suite.enums.StaffRole;
import com.wedding.suite.enums.SupplierOrderStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "supplier_order")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplierOrderEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "staff_id")
    private Long staffId;
    @Column(name = "couple_name", nullable = false, length = 64)
    private String coupleName;
    @Column(name = "wedding_date", nullable = false)
    private LocalDate weddingDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StaffRole role;
    @Column(nullable = false, length = 64)
    private String service;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SupplierOrderStatus status;
    @Column(name = "voucher_url", length = 512)
    private String voucherUrl;
}

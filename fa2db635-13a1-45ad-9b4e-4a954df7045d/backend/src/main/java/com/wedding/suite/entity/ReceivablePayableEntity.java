package com.wedding.suite.entity;

import com.wedding.suite.enums.FinanceType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "receivable_payable")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReceivablePayableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "wedding_id")
    private Long weddingId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private FinanceType type;
    @Column(nullable = false, length = 64)
    private String party;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(name = "due_date")
    private LocalDate dueDate;
    @Column(name = "days_overdue", nullable = false)
    private Integer daysOverdue;
    @Column(nullable = false)
    private Boolean settled;
}

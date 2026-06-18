package com.wedding.suite.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "contract_clause")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ContractClauseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "contract_id", nullable = false)
    private Long contractId;
    @Column(name = "clause_key", nullable = false, length = 16)
    private String clauseKey;
    @Column(nullable = false, length = 64)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;
    @Column(name = "is_addon", nullable = false)
    private Boolean isAddon;
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;
}

package com.wedding.suite.entity;

import com.wedding.suite.enums.ContractStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contract")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ContractEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "wedding_id", nullable = false)
    private Long weddingId;
    @Column(name = "couple_name", nullable = false, length = 64)
    private String coupleName;
    @Column(name = "package_name", nullable = false, length = 64)
    private String packageName;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ContractStatus status;
    @Column(length = 512)
    private String signature;
    @Column(name = "sign_url", length = 512)
    private String signUrl;
    @Column(name = "flow_id", length = 128)
    private String flowId;
    @Column(name = "signed_at")
    private LocalDateTime signedAt;
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "contractId", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder asc")
    @Builder.Default
    private List<ContractClauseEntity> clauses = new ArrayList<>();

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}

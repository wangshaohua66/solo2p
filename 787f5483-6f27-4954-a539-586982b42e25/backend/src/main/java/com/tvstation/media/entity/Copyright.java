package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "copyrights", indexes = {
    @Index(name = "idx_copyright_status", columnList = "status"),
    @Index(name = "idx_copyright_owner", columnList = "owner"),
    @Index(name = "idx_copyright_end_date", columnList = "endDate"),
    @Index(name = "idx_copyright_type", columnList = "type")
})
public class Copyright extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(nullable = false, length = 200)
    private String owner;

    @Column(columnDefinition = "TEXT")
    private String authorizationScope;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Column(precision = 12, scale = 2)
    private BigDecimal cost;

    @ElementCollection
    @CollectionTable(name = "copyright_materials", joinColumns = @JoinColumn(name = "copyrightId"))
    @Column(name = "materialId")
    @Builder.Default
    private List<Long> materialIds = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CopyrightStatus status;

    @Column(length = 500)
    private String contractUrl;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    public enum CopyrightStatus {
        active, expiring, expired
    }
}

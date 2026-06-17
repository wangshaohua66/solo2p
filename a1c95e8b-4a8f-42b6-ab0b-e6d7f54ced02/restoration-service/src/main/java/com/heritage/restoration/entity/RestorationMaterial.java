package com.heritage.restoration.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "restoration_materials")
public class RestorationMaterial {
    @Id
    private String id;

    @Indexed
    private String projectId;

    private String name;

    private String category;

    private BigDecimal quantity;

    private String unit;

    private BigDecimal unitPrice;

    private BigDecimal totalPrice;

    private String supplier;

    private String batchNo;

    private LocalDateTime usedAt;

    private String operatorId;

    private String remark;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

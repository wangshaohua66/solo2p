package com.glassstudio.dto;

import com.glassstudio.entity.Batch;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FifoCheckoutResult {

    private String materialName;

    private BigDecimal totalQuantity;

    private BigDecimal totalCost;

    private List<BatchCheckoutItem> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BatchCheckoutItem {
        private Long batchId;
        private String batchNo;
        private BigDecimal quantity;
        private BigDecimal unitPrice;
        private BigDecimal subtotal;
    }
}

package com.emergency.inventory.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@Schema(description = "物资调拨路线结果")
public class AllocationRouteResult implements Serializable {

    @Schema(description = "调拨单号")
    private String allocationNo;

    @Schema(description = "是否可行")
    private boolean feasible;

    @Schema(description = "总距离(公里)")
    private BigDecimal totalDistance;

    @Schema(description = "预计时长(分钟)")
    private Integer estimatedDuration;

    @Schema(description = "预计总成本")
    private BigDecimal totalCost;

    @Schema(description = "路线详情")
    private List<AllocationRouteItem> routes;

    @Schema(description = "不可满足的物资")
    private List<String> unavailableMaterials;

    @Data
    @Builder
    @Schema(description = "路线明细")
    public static class AllocationRouteItem implements Serializable {
        private Long warehouseId;
        private String warehouseName;
        private Long materialId;
        private String materialName;
        private Integer allocatedQuantity;
        private BigDecimal distance;
        private Integer duration;
        private BigDecimal cost;
        private String suggestedRoute;
    }
}

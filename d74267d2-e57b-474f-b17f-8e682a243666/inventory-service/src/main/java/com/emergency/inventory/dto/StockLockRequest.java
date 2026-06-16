package com.emergency.inventory.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Schema(description = "物资锁定请求")
public class StockLockRequest implements Serializable {

    @Schema(description = "灾情ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "灾情ID不能为空")
    private Long incidentId;

    @Schema(description = "调度方案ID")
    private Long dispatchPlanId;

    @Schema(description = "灾情位置经度")
    @NotNull(message = "经度不能为空")
    private Double lng;

    @Schema(description = "灾情位置纬度")
    @NotNull(message = "纬度不能为空")
    private Double lat;

    @Schema(description = "搜索半径(公里)", defaultValue = "100")
    private Integer radius = 100;

    @Schema(description = "锁定时长(分钟)", defaultValue = "60")
    private Integer lockMinutes = 60;

    @Schema(description = "锁定原因")
    private String reason;

    @Schema(description = "物资明细列表", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "物资明细不能为空")
    private List<StockLockItem> items;

    @Data
    @Schema(description = "锁定物资明细")
    public static class StockLockItem implements Serializable {
        @Schema(description = "物资ID")
        @NotNull(message = "物资ID不能为空")
        private Long materialId;

        @Schema(description = "物资编码")
        private String materialCode;

        @Schema(description = "需求数量")
        @NotNull(message = "需求数量不能为空")
        private Integer quantity;
    }
}

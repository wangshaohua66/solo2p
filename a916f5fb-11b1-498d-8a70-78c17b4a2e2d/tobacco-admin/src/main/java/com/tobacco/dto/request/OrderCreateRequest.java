package com.tobacco.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "创建订单请求")
public class OrderCreateRequest {

    @NotNull(message = "零售户ID不能为空")
    @Schema(description = "零售户ID", example = "1")
    private Long retailerId;

    @Schema(description = "订货周期", example = "2024-W01")
    private String orderPeriod;

    @NotEmpty(message = "订单项不能为空")
    @Valid
    @Schema(description = "订单项列表")
    private List<OrderItemRequest> items;

    @Data
    @Schema(description = "订单项")
    public static class OrderItemRequest {

        @NotBlank(message = "卷烟编码不能为空")
        @Schema(description = "卷烟编码", example = "HY001")
        private String cigaretteCode;

        @NotNull(message = "订购数量不能为空")
        @Schema(description = "订购数量（条）", example = "10")
        private Integer quantity;
    }
}

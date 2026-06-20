package com.tobacco.dto.request;

import com.tobacco.dto.request.PageQuery;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "订单查询参数")
public class OrderQuery extends PageQuery {

    @Schema(description = "订单状态：0待审核 1已确认 2已配货 3配送中 4已完成 5已取消")
    private Integer status;

    @Schema(description = "零售户ID")
    private Long retailerId;

    @Schema(description = "县局ID")
    private Long countyId;

    @Schema(description = "管理所ID")
    private Long stationId;

    @Schema(description = "订货周期")
    private String orderPeriod;

    @Schema(description = "关键词（订单号/店铺名称）")
    private String keyword;
}

package com.tobacco.dto.request;

import com.tobacco.dto.request.PageQuery;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "许可证查询参数")
public class LicenseQuery extends PageQuery {

    @Schema(description = "许可证状态")
    private Integer status;

    @Schema(description = "经营业态")
    private String businessType;

    @Schema(description = "申请类型")
    private String applicationType;

    @Schema(description = "县局ID")
    private Long countyId;

    @Schema(description = "管理所ID")
    private Long stationId;

    @Schema(description = "关键词（许可证号/店铺名称/法人）")
    private String keyword;
}

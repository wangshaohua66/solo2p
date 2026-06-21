package com.court.execution.dto;

import com.court.execution.entity.PropertyType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "财产登记请求")
public class PropertyRegisterRequest {

    @NotNull(message = "案件ID不能为空")
    @Schema(description = "案件ID", required = true)
    private Long caseId;

    @NotNull(message = "财产类型不能为空")
    @Schema(description = "财产类型", required = true)
    private PropertyType propertyType;

    @NotBlank(message = "财产名称不能为空")
    @Schema(description = "财产名称", required = true)
    private String propertyName;

    @Schema(description = "财产描述")
    private String propertyDescription;

    @Schema(description = "预估价值")
    private BigDecimal estimatedValue;

    @Schema(description = "财产所在地")
    private String propertyLocation;

    @Schema(description = "证件/证号")
    private String certificateNumber;

    @Schema(description = "备注")
    private String remark;
}

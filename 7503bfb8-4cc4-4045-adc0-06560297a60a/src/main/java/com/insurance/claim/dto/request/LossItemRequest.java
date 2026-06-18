package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Schema(description = "损失项目")
public class LossItemRequest {

    @Schema(description = "项目类型 1-配件 2-工时 3-材料 4-其他", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "项目类型不能为空")
    private Integer itemType;

    @Schema(description = "项目分类", example = "外观件")
    @Size(max = 50, message = "项目分类长度不能超过50字符")
    private String itemCategory;

    @Schema(description = "项目编码", example = "PART001")
    @Size(max = 32, message = "项目编码长度不能超过32字符")
    private String itemCode;

    @Schema(description = "项目名称", requiredMode = Schema.RequiredMode.REQUIRED, example = "前保险杠")
    @NotBlank(message = "项目名称不能为空")
    @Size(max = 100, message = "项目名称长度不能超过100字符")
    private String itemName;

    @Schema(description = "项目描述", example = "前保险杠总成，带喷漆")
    @Size(max = 200, message = "项目描述长度不能超过200字符")
    private String itemDescription;

    @Schema(description = "数量", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "数量不能为空")
    private Integer quantity;

    @Schema(description = "单位", example = "个")
    @Size(max = 10, message = "单位长度不能超过10字符")
    private String unit;

    @Schema(description = "区域指导价", example = "1500.00")
    private BigDecimal guidePrice;

    @Schema(description = "单价", requiredMode = Schema.RequiredMode.REQUIRED, example = "1500.00")
    @NotNull(message = "单价不能为空")
    private BigDecimal unitPrice;

    @Schema(description = "价格区域", example = "华北区")
    @Size(max = 20, message = "价格区域长度不能超过20字符")
    private String priceRegion;

    @Schema(description = "备注", example = "原厂配件")
    @Size(max = 200, message = "备注长度不能超过200字符")
    private String remark;
}

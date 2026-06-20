package com.tobacco.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "许可证审批请求")
public class LicenseReviewRequest {

    @NotNull(message = "许可证ID不能为空")
    @Schema(description = "许可证ID", example = "1")
    private Long licenseId;

    @NotNull(message = "审批结果不能为空")
    @Schema(description = "审批结果：1通过，2驳回", example = "1")
    private Integer reviewResult;

    @NotBlank(message = "审批意见不能为空")
    @Schema(description = "审批意见", example = "材料齐全，符合条件，同意通过")
    private String reviewOpinion;

    @Schema(description = "审批级别：1初审，2复审，3终审", example = "1")
    private Integer reviewLevel;
}

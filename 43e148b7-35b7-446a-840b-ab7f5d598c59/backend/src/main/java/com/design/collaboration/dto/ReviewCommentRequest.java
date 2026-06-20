package com.design.collaboration.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "添加校审意见请求")
public class ReviewCommentRequest {

    @NotNull(message = "校审记录ID不能为空")
    @Schema(description = "校审记录ID", required = true)
    private Long reviewRecordId;

    @NotBlank(message = "意见内容不能为空")
    @Schema(description = "意见内容", required = true)
    private String content;

    @Schema(description = "图纸位置标注")
    private String location;
}

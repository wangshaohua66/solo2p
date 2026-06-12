package com.carbon.common.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "分页查询参数")
public class PageQuery {

    @Schema(description = "页码(从0开始)", example = "0")
    @Min(value = 0, message = "页码最小为0")
    @Builder.Default
    private Integer page = 0;

    @Schema(description = "每页条数", example = "20")
    @Min(value = 1, message = "每页条数最小为1")
    @Max(value = 1000, message = "每页条数最大为1000")
    @Builder.Default
    private Integer size = 20;

    @Schema(description = "排序字段", example = "createdAt")
    private String sortBy;

    @Schema(description = "排序方向 ASC/DESC", example = "DESC")
    @Builder.Default
    private String sortDirection = "DESC";
}

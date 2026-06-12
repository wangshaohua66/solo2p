package com.carbon.common.api;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "分页响应")
public class PageResult<T> {

    @Schema(description = "数据列表")
    private List<T> content;

    @Schema(description = "页码(从0开始)", example = "0")
    private Integer page;

    @Schema(description = "每页条数", example = "20")
    private Integer size;

    @Schema(description = "总条数", example = "1000")
    private Long total;

    @Schema(description = "总页数", example = "50")
    private Integer totalPages;

    public static <T> PageResult<T> of(List<T> content, Integer page, Integer size, Long total) {
        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) total / size);
        return PageResult.<T>builder()
                .content(content)
                .page(page)
                .size(size)
                .total(total)
                .totalPages(totalPages)
                .build();
    }
}

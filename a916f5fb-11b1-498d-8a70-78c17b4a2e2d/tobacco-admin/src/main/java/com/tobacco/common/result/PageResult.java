package com.tobacco.common.result;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Schema(description = "分页结果")
public class PageResult<T> implements Serializable {

    @Schema(description = "总记录数", example = "100")
    private Long total;

    @Schema(description = "总页数", example = "10")
    private Long pages;

    @Schema(description = "当前页数据")
    private List<T> records;

    public PageResult() {
    }

    public PageResult(Long total, Long pages, List<T> records) {
        this.total = total;
        this.pages = pages;
        this.records = records;
    }

    public static <T> PageResult<T> of(Long total, Long pages, List<T> records) {
        return new PageResult<>(total, pages, records);
    }

    public static <T> PageResult<T> of(long total, long size, List<T> records) {
        long pages = total % size == 0 ? total / size : total / size + 1;
        return new PageResult<>(total, pages, records);
    }
}

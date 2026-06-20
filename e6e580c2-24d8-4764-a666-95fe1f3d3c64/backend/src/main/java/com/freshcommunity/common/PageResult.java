package com.freshcommunity.common;

import lombok.Data;
import java.io.Serializable;
import java.util.List;

@Data
public class PageResult<T> implements Serializable {

    private Long total;
    private List<T> records;
    private Integer pageNum;
    private Integer pageSize;

    public PageResult() {
    }

    public PageResult(Long total, List<T> records, Integer pageNum, Integer pageSize) {
        this.total = total;
        this.records = records;
        this.pageNum = pageNum;
        this.pageSize = pageSize;
    }

    public static <T> PageResult<T> of(Long total, List<T> records, Integer pageNum, Integer pageSize) {
        return new PageResult<>(total, records, pageNum, pageSize);
    }
}

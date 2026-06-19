package com.talentmarket.common.result;

import lombok.Data;
import java.util.Collections;
import java.util.List;

@Data
public class PageResult<T> {

    private List<T> list;
    private long total;
    private long page;
    private long pageSize;

    public PageResult() {
        this.list = Collections.emptyList();
        this.total = 0;
        this.page = 1;
        this.pageSize = 10;
    }

    public PageResult(List<T> list, long total, long page, long pageSize) {
        this.list = list;
        this.total = total;
        this.page = page;
        this.pageSize = pageSize;
    }

    public static <T> PageResult<T> of(List<T> list, long total, long page, long pageSize) {
        return new PageResult<>(list, total, page, pageSize);
    }
}

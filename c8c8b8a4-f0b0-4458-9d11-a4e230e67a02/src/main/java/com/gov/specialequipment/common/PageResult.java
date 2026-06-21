package com.gov.specialequipment.common;

import lombok.Data;

import java.util.List;

@Data
public class PageResult<T> {

    private List<T> records;
    private Long total;
    private Long current;
    private Long size;
    private Long pages;

    public PageResult() {
    }

    public PageResult(List<T> records, Long total, Long current, Long size) {
        this.records = records;
        this.total = total;
        this.current = current;
        this.size = size;
        this.pages = size > 0 ? (total + size - 1) / size : 0;
    }
}

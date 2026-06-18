package com.iccert.common.page;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.Data;
import java.io.Serializable;
import java.util.List;

@Data
public class PageResult<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    private List<T> records;
    private long total;
    private long size;
    private long current;
    private long pages;

    public static <T> PageResult<T> of(IPage<T> page) {
        PageResult<T> r = new PageResult<>();
        r.setRecords(page.getRecords());
        r.setTotal(page.getTotal());
        r.setSize(page.getSize());
        r.setCurrent(page.getCurrent());
        r.setPages(page.getPages());
        return r;
    }

    public static <T> PageResult<T> of(List<T> list, long total, long size, long current) {
        PageResult<T> r = new PageResult<>();
        r.setRecords(list);
        r.setTotal(total);
        r.setSize(size);
        r.setCurrent(current);
        r.setPages(size > 0 ? (total + size - 1) / size : 0);
        return r;
    }
}

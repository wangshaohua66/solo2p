package com.iccert.common.page;

import lombok.Data;
import java.io.Serializable;

@Data
public class PageQuery implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long current = 1L;
    private Long size = 10L;
    private String keyword;
    private String sortBy;
    private String sortOrder = "desc";

    public long getCurrentSafe() {
        return current == null || current < 1 ? 1 : current;
    }

    public long getSizeSafe() {
        if (size == null || size < 1) return 10;
        return Math.min(size, 200);
    }
}

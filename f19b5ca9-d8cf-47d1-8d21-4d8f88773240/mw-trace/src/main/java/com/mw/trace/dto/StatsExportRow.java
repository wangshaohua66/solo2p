package com.mw.trace.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import lombok.Data;

@Data
public class StatsExportRow {

    @ExcelProperty("分组")
    @ColumnWidth(20)
    private String groupKey;

    @ExcelProperty("产生量(kg)")
    @ColumnWidth(16)
    private Double producedKg;

    @ExcelProperty("收运量(kg)")
    @ColumnWidth(16)
    private Double transferredKg;

    @ExcelProperty("处置量(kg)")
    @ColumnWidth(16)
    private Double disposedKg;

    @ExcelProperty("产生记录数")
    @ColumnWidth(14)
    private Long producedCount;
}

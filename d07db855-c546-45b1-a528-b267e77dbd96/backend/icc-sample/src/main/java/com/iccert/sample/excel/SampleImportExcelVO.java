package com.iccert.sample.excel;

import com.alibaba.excel.annotation.ExcelProperty;
import lombok.Data;

@Data
public class SampleImportExcelVO {

    @ExcelProperty(index = 0, value = "样品名称")
    private String sampleName;

    @ExcelProperty(index = 1, value = "规格型号")
    private String sampleModel;

    @ExcelProperty(index = 2, value = "企业内部编码")
    private String sampleCodeInternal;

    @ExcelProperty(index = 3, value = "委托企业名称")
    private String companyName;

    @ExcelProperty(index = 4, value = "产品类别")
    private String productCategoryName;

    @ExcelProperty(index = 5, value = "认证类型")
    private String certTypeCode;

    @ExcelProperty(index = 6, value = "数量")
    private Integer sampleAmount;

    @ExcelProperty(index = 7, value = "单位")
    private String sampleUnit;

    @ExcelProperty(index = 8, value = "优先级(HIGH/MEDIUM/NORMAL)")
    private String priority;

    @ExcelProperty(index = 9, value = "备注")
    private String remark;
}

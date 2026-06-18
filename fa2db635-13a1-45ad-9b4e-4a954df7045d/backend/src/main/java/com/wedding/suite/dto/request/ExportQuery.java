package com.wedding.suite.dto.request;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ExportQuery {
    @Pattern(regexp = "finance|wedding|report|contract", message = "导出类型非法")
    private String type = "finance";

    private Long storeId;
    private String from;
    private String to;
}

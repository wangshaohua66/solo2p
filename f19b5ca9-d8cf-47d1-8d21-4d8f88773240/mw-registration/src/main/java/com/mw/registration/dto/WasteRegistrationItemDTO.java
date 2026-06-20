package com.mw.registration.dto;

import com.mw.common.enums.WasteCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class WasteRegistrationItemDTO {

    @NotBlank(message = "产废科室不能为空")
    private String department;

    @NotNull(message = "废物类别不能为空")
    private WasteCategory category;

    @NotNull(message = "重量不能为空")
    @DecimalMin(value = "0.01", message = "重量必须大于0")
    private Double weightKg;

    @NotBlank(message = "包装编号不能为空")
    private String packageNo;

    private String operatorName;

    private List<String> attachmentUrls;
}

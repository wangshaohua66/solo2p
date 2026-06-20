package com.mw.registration.dto;

import com.mw.common.enums.WasteCategory;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class ManifestCreateRequest {

    @NotEmpty(message = "关联追溯编码不能为空")
    @Size(max = 2000, message = "联单追溯编码数量超限")
    private List<String> traceCodes;

    private String transporterOrgId;

    private String transporterOrgName;

    private String disposerOrgId;

    private String disposerOrgName;

    private WasteCategory preferredCategory;
}

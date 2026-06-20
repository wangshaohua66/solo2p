package com.mw.registration.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ManifestOperateRequest {

    @NotBlank(message = "联单编号不能为空")
    private String manifestNo;

    private String remark;
}

package com.carbon.dto.emission;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class EmissionVerifyDTO {

    @NotNull(message = "报告ID不能为空")
    private Long reportId;

    @NotBlank(message = "核验结果不能为空")
    @Pattern(regexp = "VERIFIED|REJECTED", message = "核验结果仅支持VERIFIED或REJECTED")
    private String verifyResult;

    @Size(max = 500, message = "核验备注不超过500字")
    private String verifyRemark;
}

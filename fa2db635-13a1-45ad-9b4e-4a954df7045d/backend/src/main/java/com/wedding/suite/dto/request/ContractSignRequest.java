package com.wedding.suite.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ContractSignRequest {

    @Size(max = 512, message = "签名数据长度不能超过512字符")
    private String signature;

    @NotBlank(message = "签署人姓名不能为空")
    @Size(max = 64, message = "签署人姓名长度不能超过64字符")
    private String signer;

    @Size(max = 512, message = "签署链接长度不能超过512字符")
    private String signUrl;

    @NotBlank(message = "签署人手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "签署人手机号格式不正确")
    private String signerPhone;

    @Size(max = 128, message = "流程ID长度不能超过128字符")
    private String flowId;
}

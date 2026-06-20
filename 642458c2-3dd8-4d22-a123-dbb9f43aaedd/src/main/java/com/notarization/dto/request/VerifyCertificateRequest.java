package com.notarization.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyCertificateRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "公证书验证编码不能为空")
    private String verificationCode;
}

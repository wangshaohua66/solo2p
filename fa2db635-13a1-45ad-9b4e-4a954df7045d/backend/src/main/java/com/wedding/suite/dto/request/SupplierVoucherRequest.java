package com.wedding.suite.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SupplierVoucherRequest {
    @NotBlank(message = "凭证地址不能为空")
    private String fileUrl;
}

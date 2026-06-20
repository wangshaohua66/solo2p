package com.notarization.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchVerifyRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotEmpty(message = "验证编码列表不能为空")
    private List<String> verificationCodes;
}

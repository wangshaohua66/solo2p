package com.carbon.dto.quota;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class QuotaIssueDTO {

    @NotNull(message = "配额ID不能为空")
    private Long quotaId;
}

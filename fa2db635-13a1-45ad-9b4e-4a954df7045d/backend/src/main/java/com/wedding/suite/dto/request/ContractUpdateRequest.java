package com.wedding.suite.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ContractUpdateRequest {
    @NotEmpty(message = "合同条款不能为空")
    @Valid
    private List<ContractClauseRequest> clauses;

    @DecimalMin(value = "0.0", message = "合同金额不能为负")
    private BigDecimal amount;
}

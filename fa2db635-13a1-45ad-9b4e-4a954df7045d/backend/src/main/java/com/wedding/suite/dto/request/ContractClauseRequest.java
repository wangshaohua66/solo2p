package com.wedding.suite.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ContractClauseRequest {
    private String id;
    @NotBlank(message = "条款标题不能为空")
    private String title;
    @NotBlank(message = "条款内容不能为空")
    private String body;
    private Boolean isAddon;
}

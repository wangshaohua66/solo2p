package com.court.execution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "案件立案请求")
public class CaseFilingRequest {

    @NotBlank(message = "案号不能为空")
    @Schema(description = "案号", required = true)
    private String caseNumber;

    @NotBlank(message = "案件名称不能为空")
    @Schema(description = "案件名称", required = true)
    private String caseName;

    @Schema(description = "执行依据")
    private String executionBasis;

    @Schema(description = "执行标的金额")
    private BigDecimal executionAmount;

    @NotBlank(message = "被执行人姓名不能为空")
    @Schema(description = "被执行人姓名", required = true)
    private String debtorName;

    @Schema(description = "被执行人身份证号")
    private String debtorIdCard;

    @Schema(description = "被执行人地址")
    private String debtorAddress;

    @Schema(description = "被执行人电话")
    private String debtorPhone;

    @Schema(description = "申请执行人姓名")
    private String creditorName;

    @NotNull(message = "执行法官ID不能为空")
    @Schema(description = "执行法官ID", required = true)
    private Long judgeId;

    @Schema(description = "执行助理ID")
    private Long assistantId;

    @Schema(description = "备注")
    private String remark;
}

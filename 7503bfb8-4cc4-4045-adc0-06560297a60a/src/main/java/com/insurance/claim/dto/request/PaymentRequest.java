package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Schema(description = "支付请求")
public class PaymentRequest {

    @Schema(description = "理赔案件ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1001")
    @NotNull(message = "理赔案件ID不能为空")
    private Long claimId;

    @Schema(description = "支付类型 1-首次支付 2-分期支付 3-尾款支付", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "支付类型不能为空")
    private Integer paymentType;

    @Schema(description = "支付金额", requiredMode = Schema.RequiredMode.REQUIRED, example = "7800.00")
    @NotNull(message = "支付金额不能为空")
    private BigDecimal paymentAmount;

    @Schema(description = "本次期数", example = "1")
    private Integer installmentNo;

    @Schema(description = "总期数", example = "1")
    private Integer totalInstallments;

    @Schema(description = "收款人姓名", requiredMode = Schema.RequiredMode.REQUIRED, example = "张三")
    @NotBlank(message = "收款人姓名不能为空")
    @Size(max = 50, message = "收款人姓名长度不能超过50字符")
    private String payeeName;

    @Schema(description = "收款人身份证号", requiredMode = Schema.RequiredMode.REQUIRED, example = "110101199001011234")
    @NotBlank(message = "收款人身份证号不能为空")
    @Size(max = 18, message = "收款人身份证号长度不能超过18字符")
    private String payeeIdCard;

    @Schema(description = "收款银行名称", requiredMode = Schema.RequiredMode.REQUIRED, example = "中国工商银行")
    @NotBlank(message = "收款银行名称不能为空")
    @Size(max = 50, message = "收款银行名称长度不能超过50字符")
    private String payeeBankName;

    @Schema(description = "收款银行账号", requiredMode = Schema.RequiredMode.REQUIRED, example = "6222021234567890123")
    @NotBlank(message = "收款银行账号不能为空")
    @Size(max = 32, message = "收款银行账号长度不能超过32字符")
    private String payeeBankAccount;

    @Schema(description = "收款银行开户行", example = "中国工商银行北京朝阳支行")
    @Size(max = 100, message = "收款银行开户行长度不能超过100字符")
    private String payeeBankBranch;

    @Schema(description = "收款人手机号", example = "13800138000")
    @Size(max = 11, message = "收款人手机号长度不能超过11字符")
    private String payeePhone;

    @Schema(description = "第三方收款人", example = "XX维修厂")
    @Size(max = 100, message = "第三方收款人长度不能超过100字符")
    private String thirdPartyPayee;

    @Schema(description = "第三方授权书URL", example = "https://oss.example.com/claim/20240115/auth.pdf")
    @Size(max = 500, message = "第三方授权书URL长度不能超过500字符")
    private String thirdPartyAuthorization;

    @Schema(description = "支付渠道 1-银行转账 2-支付宝 3-微信", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotBlank(message = "支付渠道不能为空")
    private String paymentChannel;

    @Schema(description = "支付方式 1-实时支付 2-批量支付", example = "1")
    private String paymentMethod;

    @Schema(description = "操作员ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "5001")
    @NotNull(message = "操作员ID不能为空")
    private Long operatorId;

    @Schema(description = "备注", example = "无")
    @Size(max = 500, message = "备注长度不能超过500字符")
    private String remark;
}

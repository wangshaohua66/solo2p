package com.insurance.claim.dto.response;

import com.insurance.claim.enums.ClaimStatus;
import com.insurance.claim.enums.InsuranceType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Schema(description = "理赔案件响应")
public class ClaimResponse {

    @Schema(description = "案件ID", example = "1001")
    private Long id;

    @Schema(description = "案件编号", example = "CL2024011500001")
    private String claimNo;

    @Schema(description = "保单号", example = "POL2024010100001")
    private String policyNo;

    @Schema(description = "险种代码", example = "1")
    private InsuranceType insuranceType;

    @Schema(description = "险种名称", example = "车险")
    private String insuranceTypeName;

    @Schema(description = "案件状态代码", example = "1")
    private ClaimStatus status;

    @Schema(description = "案件状态名称", example = "已报案")
    private String statusName;

    @Schema(description = "事故时间")
    private LocalDateTime accidentTime;

    @Schema(description = "事故地点", example = "北京市朝阳区建国路88号")
    private String accidentLocation;

    @Schema(description = "事故省份", example = "北京市")
    private String accidentProvince;

    @Schema(description = "事故城市", example = "北京市")
    private String accidentCity;

    @Schema(description = "事故区县", example = "朝阳区")
    private String accidentDistrict;

    @Schema(description = "事故经过", example = "车辆追尾")
    private String accidentDescription;

    @Schema(description = "报案人姓名", example = "张三")
    private String reporterName;

    @Schema(description = "报案人电话", example = "13800138000")
    private String reporterPhone;

    @Schema(description = "预估损失金额", example = "5000.00")
    private BigDecimal estimatedAmount;

    @Schema(description = "总损失金额", example = "8000.00")
    private BigDecimal totalLossAmount;

    @Schema(description = "免赔额", example = "200.00")
    private BigDecimal deductibleAmount;

    @Schema(description = "应赔付金额", example = "7800.00")
    private BigDecimal payableAmount;

    @Schema(description = "已支付金额", example = "0.00")
    private BigDecimal paidAmount;

    @Schema(description = "责任比例", example = "70")
    private Integer liabilityRatio;

    @Schema(description = "历史事故次数", example = "1")
    private Integer accidentCount;

    @Schema(description = "浮动系数", example = "1.1")
    private BigDecimal floatingCoefficient;

    @Schema(description = "查勘员姓名", example = "李查勘")
    private String surveyorName;

    @Schema(description = "定损员姓名", example = "王定损")
    private String assessorName;

    @Schema(description = "核赔师姓名", example = "赵核赔")
    private String reviewerName;

    @Schema(description = "财务人员姓名", example = "钱财务")
    private String financeName;

    @Schema(description = "欺诈风险评分", example = "15")
    private Integer fraudScore;

    @Schema(description = "是否欺诈可疑", example = "false")
    private Boolean fraudSuspicious;

    @Schema(description = "欺诈标记", example = "[]")
    private String fraudFlags;

    @Schema(description = "报案时间")
    private LocalDateTime reportedAt;

    @Schema(description = "查勘派工时间")
    private LocalDateTime surveyAssignedAt;

    @Schema(description = "查勘完成时间")
    private LocalDateTime surveyCompletedAt;

    @Schema(description = "定损完成时间")
    private LocalDateTime assessmentCompletedAt;

    @Schema(description = "核赔完成时间")
    private LocalDateTime reviewCompletedAt;

    @Schema(description = "赔款计算完成时间")
    private LocalDateTime calculationCompletedAt;

    @Schema(description = "支付完成时间")
    private LocalDateTime paymentCompletedAt;

    @Schema(description = "结案时间")
    private LocalDateTime closedAt;

    @Schema(description = "结案周期(天)", example = "3")
    private Integer settlementDays;

    @Schema(description = "备注")
    private String remark;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}

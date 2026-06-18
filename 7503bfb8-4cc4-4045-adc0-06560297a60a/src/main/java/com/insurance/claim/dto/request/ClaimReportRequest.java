package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Schema(description = "理赔报案请求")
public class ClaimReportRequest {

    @Schema(description = "保单号", requiredMode = Schema.RequiredMode.REQUIRED, example = "POL2024010100001")
    @NotBlank(message = "保单号不能为空")
    @Size(max = 32, message = "保单号长度不能超过32字符")
    private String policyNo;

    @Schema(description = "险种代码", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotNull(message = "险种不能为空")
    private Integer insuranceType;

    @Schema(description = "事故时间", requiredMode = Schema.RequiredMode.REQUIRED, example = "2024-01-15T14:30:00")
    @NotNull(message = "事故时间不能为空")
    private LocalDateTime accidentTime;

    @Schema(description = "事故地点", requiredMode = Schema.RequiredMode.REQUIRED, example = "北京市朝阳区建国路88号")
    @NotBlank(message = "事故地点不能为空")
    @Size(max = 200, message = "事故地点长度不能超过200字符")
    private String accidentLocation;

    @Schema(description = "事故省份", example = "北京市")
    private String accidentProvince;

    @Schema(description = "事故城市", example = "北京市")
    private String accidentCity;

    @Schema(description = "事故区县", example = "朝阳区")
    private String accidentDistrict;

    @Schema(description = "事故经度", example = "116.455144")
    private BigDecimal accidentLongitude;

    @Schema(description = "事故纬度", example = "39.904989")
    private BigDecimal accidentLatitude;

    @Schema(description = "事故经过描述", requiredMode = Schema.RequiredMode.REQUIRED, example = "车辆追尾，造成前车尾部受损")
    @NotBlank(message = "事故经过不能为空")
    @Size(max = 1000, message = "事故经过描述长度不能超过1000字符")
    private String accidentDescription;

    @Schema(description = "报案人姓名", requiredMode = Schema.RequiredMode.REQUIRED, example = "张三")
    @NotBlank(message = "报案人姓名不能为空")
    @Size(max = 50, message = "报案人姓名长度不能超过50字符")
    private String reporterName;

    @Schema(description = "报案人手机号", requiredMode = Schema.RequiredMode.REQUIRED, example = "13800138000")
    @NotBlank(message = "报案人手机号不能为空")
    @Size(max = 11, message = "手机号长度不能超过11字符")
    private String reporterPhone;

    @Schema(description = "报案人身份证号", example = "110101199001011234")
    @Size(max = 18, message = "身份证号长度不能超过18字符")
    private String reporterIdCard;

    @Schema(description = "预估损失金额", example = "5000.00")
    private BigDecimal estimatedAmount;

    @Schema(description = "涉案方信息")
    private List<ClaimPartyRequest> parties;

    @Schema(description = "上传材料")
    private List<DocumentUploadRequest> documents;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注长度不能超过500字符")
    private String remark;
}

package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Schema(description = "涉案方信息")
public class ClaimPartyRequest {

    @Schema(description = "涉案方类型 1-本车 2-三者车 3-三者人 4-三者物", example = "1")
    private Integer partyType;

    @Schema(description = "姓名", example = "李四")
    @Size(max = 50, message = "姓名长度不能超过50字符")
    private String partyName;

    @Schema(description = "身份证号", example = "110101199002022345")
    @Size(max = 18, message = "身份证号长度不能超过18字符")
    private String partyIdCard;

    @Schema(description = "联系电话", example = "13900139000")
    @Size(max = 11, message = "电话长度不能超过11字符")
    private String partyPhone;

    @Schema(description = "驾驶证号", example = "110101199001011234")
    @Size(max = 18, message = "驾驶证号长度不能超过18字符")
    private String driverLicenseNo;

    @Schema(description = "准驾车型", example = "C1")
    @Size(max = 10, message = "准驾车型长度不能超过10字符")
    private String driverLicenseType;

    @Schema(description = "车牌号", example = "京A12345")
    @Size(max = 10, message = "车牌号长度不能超过10字符")
    private String vehiclePlateNo;

    @Schema(description = "车辆类型", example = "小型轿车")
    @Size(max = 20, message = "车辆类型长度不能超过20字符")
    private String vehicleType;

    @Schema(description = "保险公司", example = "XX保险公司")
    @Size(max = 50, message = "保险公司长度不能超过50字符")
    private String insuranceCompany;

    @Schema(description = "保单号", example = "POL2024010100002")
    @Size(max = 32, message = "保单号长度不能超过32字符")
    private String policyNo;

    @Schema(description = "保险金额", example = "200000.00")
    private BigDecimal insuranceAmount;

    @Schema(description = "责任比例", example = "70")
    private Integer liabilityRatio;

    @Schema(description = "伤情描述", example = "轻微擦伤")
    @Size(max = 200, message = "伤情描述长度不能超过200字符")
    private String injuryDescription;

    @Schema(description = "财产损失描述", example = "车辆前部受损")
    @Size(max = 200, message = "财产损失描述长度不能超过200字符")
    private String propertyDamageDescription;

    @Schema(description = "备注", example = "无其他损失")
    @Size(max = 200, message = "备注长度不能超过200字符")
    private String remark;
}

package com.tobacco.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "许可证申请请求")
public class LicenseApplyRequest {

    @NotBlank(message = "申请类型不能为空")
    @Schema(description = "申请类型：NEW新办, RENEWAL延续, CHANGE变更, SUSPEND停业, RESUME恢复, CANCEL注销", example = "NEW")
    private String applicationType;

    @Schema(description = "零售户ID（新办时可为空）")
    private Long retailerId;

    @NotBlank(message = "店铺名称不能为空")
    @Schema(description = "店铺名称", example = "阳光便利店")
    private String retailerName;

    @NotBlank(message = "经营业态不能为空")
    @Schema(description = "经营业态", example = "便利店")
    private String businessType;

    @NotNull(message = "经营面积不能为空")
    @Schema(description = "经营面积（平方米）", example = "50")
    private BigDecimal businessArea;

    @NotBlank(message = "经营范围不能为空")
    @Schema(description = "经营范围", example = "卷烟、雪茄烟")
    private String businessScope;

    @NotBlank(message = "法人姓名不能为空")
    @Schema(description = "法人姓名", example = "张三")
    private String legalPerson;

    @NotBlank(message = "身份证号不能为空")
    @Schema(description = "身份证号", example = "110101199001011234")
    private String idCardNo;

    @NotBlank(message = "联系电话不能为空")
    @Schema(description = "联系电话", example = "13800138000")
    private String phone;

    @NotBlank(message = "省份不能为空")
    @Schema(description = "省份", example = "山东省")
    private String province;

    @NotBlank(message = "城市不能为空")
    @Schema(description = "城市", example = "济南市")
    private String city;

    @NotBlank(message = "区县不能为空")
    @Schema(description = "区县", example = "历下区")
    private String county;

    @NotBlank(message = "经营地址不能为空")
    @Schema(description = "经营地址", example = "济南市历下区解放路100号")
    private String address;

    @NotNull(message = "经度不能为空")
    @Schema(description = "经度", example = "117.000000")
    private BigDecimal longitude;

    @NotNull(message = "纬度不能为空")
    @Schema(description = "纬度", example = "36.600000")
    private BigDecimal latitude;

    @Schema(description = "原许可证ID（变更、延续时使用）")
    private Long originalLicenseId;

    @Schema(description = "县局ID")
    private Long countyId;

    @Schema(description = "管理所ID")
    private Long stationId;

    @Schema(description = "备注")
    private String remark;
}

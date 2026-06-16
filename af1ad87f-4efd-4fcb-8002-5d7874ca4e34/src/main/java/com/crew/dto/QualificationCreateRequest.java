package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
@Schema(description = "资质创建请求")
public class QualificationCreateRequest {

    @NotNull(message = "机组人员ID不能为空")
    @Schema(description = "机组人员ID")
    private Long crewId;

    @NotBlank(message = "资质类型不能为空")
    @Schema(description = "资质类型: LICENSE/TYPE_RATING/MEDICAL/LANGUAGE", example = "TYPE_RATING")
    private String qualType;

    @Schema(description = "资质编号")
    private String qualCode;

    @Schema(description = "机型（机型资格时必填）", example = "B737")
    private String aircraftType;

    @Schema(description = "签发日期")
    private LocalDate issueDate;

    @NotNull(message = "到期日期不能为空")
    @Schema(description = "到期日期")
    private LocalDate expiryDate;

    @Schema(description = "语言等级（语言资质时填写）", example = "ICAO4")
    private String languageLevel;

    @Schema(description = "备注")
    private String remark;
}

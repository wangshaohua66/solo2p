package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "机组人员创建请求")
public class CrewCreateRequest {

    @NotBlank(message = "机组编号不能为空")
    @Schema(description = "机组编号", example = "P001")
    private String crewCode;

    @NotBlank(message = "姓名不能为空")
    @Schema(description = "姓名", example = "张三")
    private String name;

    @NotBlank(message = "人员类型不能为空")
    @Schema(description = "人员类型: PILOT/ATTENDANT", example = "PILOT")
    private String type;

    @Schema(description = "职级: CAPTAIN/FO/PURSER/ATTENDANT", example = "CAPTAIN")
    private String rank;

    @Schema(description = "基地", example = "PEK")
    private String base;

    @Schema(description = "语言资质", example = "ZH,EN")
    private String language;

    @Schema(description = "状态: AVAILABLE/ON_DUTY/LEAVE/GROUNDED", example = "AVAILABLE")
    private String status;
}

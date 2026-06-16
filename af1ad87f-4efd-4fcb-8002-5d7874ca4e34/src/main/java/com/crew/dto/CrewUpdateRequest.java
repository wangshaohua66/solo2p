package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "机组人员更新请求")
public class CrewUpdateRequest {

    @Schema(description = "姓名")
    private String name;

    @Schema(description = "职级")
    private String rank;

    @Schema(description = "基地")
    private String base;

    @Schema(description = "语言资质")
    private String language;

    @Schema(description = "状态")
    private String status;
}

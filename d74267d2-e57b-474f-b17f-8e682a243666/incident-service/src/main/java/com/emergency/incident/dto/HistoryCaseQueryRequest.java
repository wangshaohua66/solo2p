package com.emergency.incident.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "历史案例查询请求")
public class HistoryCaseQueryRequest {

    @Schema(description = "灾害类型")
    private Integer incidentType;

    @Schema(description = "灾害级别")
    private Integer incidentLevel;

    @Schema(description = "区域编码")
    private String regionCode;

    @Schema(description = "是否经典案例")
    private Boolean isClassic;

    @Schema(description = "标签")
    private String tags;

    @Schema(description = "关键词")
    private String keyword;

    @Schema(description = "页码", defaultValue = "1")
    private Integer pageNum = 1;

    @Schema(description = "每页条数", defaultValue = "10")
    private Integer pageSize = 10;
}

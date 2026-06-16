package com.emergency.incident.dto;

import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.enums.IncidentType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Schema(description = "灾情查询条件")
public class IncidentQueryRequest implements Serializable {

    @Schema(description = "页码")
    private Integer pageNum = 1;

    @Schema(description = "每页条数")
    private Integer pageSize = 10;

    @Schema(description = "灾害类型")
    private IncidentType type;

    @Schema(description = "灾情等级")
    private IncidentLevel level;

    @Schema(description = "灾情状态")
    private IncidentStatus status;

    @Schema(description = "行政区划代码")
    private String regionCode;

    @Schema(description = "归属组织ID")
    private Long organizationId;

    @Schema(description = "开始时间")
    private LocalDateTime startTime;

    @Schema(description = "结束时间")
    private LocalDateTime endTime;

    @Schema(description = "关键词")
    private String keyword;

    @Schema(description = "排序字段")
    private String orderBy = "createdAt";

    @Schema(description = "排序方向")
    private String orderDir = "DESC";
}

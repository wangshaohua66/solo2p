package com.tobacco.dto.request;

import com.tobacco.dto.request.PageQuery;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "违规记录查询参数")
public class ViolationRecordQuery extends PageQuery {

    @Schema(description = "违规状态：0待处理 1已处理 2已结案")
    private Integer status;

    @Schema(description = "违规类型")
    private Integer violationType;

    @Schema(description = "严重程度：high高 medium中 low低")
    private String severity;

    @Schema(description = "县局ID")
    private Long countyId;

    @Schema(description = "管理所ID")
    private Long stationId;

    @Schema(description = "关键词")
    private String keyword;
}

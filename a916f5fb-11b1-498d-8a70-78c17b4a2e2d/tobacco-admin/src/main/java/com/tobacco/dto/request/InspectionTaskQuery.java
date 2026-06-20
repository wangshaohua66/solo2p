package com.tobacco.dto.request;

import com.tobacco.dto.request.PageQuery;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "稽查任务查询参数")
public class InspectionTaskQuery extends PageQuery {

    @Schema(description = "任务状态：0待派发 1待执行 2执行中 3已完成")
    private Integer status;

    @Schema(description = "稽查员ID")
    private Long inspectorId;

    @Schema(description = "县局ID")
    private Long countyId;

    @Schema(description = "管理所ID")
    private Long stationId;

    @Schema(description = "风险等级：high高 medium中 low低")
    private String riskLevel;

    @Schema(description = "是否有违规：0无 1有")
    private Integer hasViolation;
}

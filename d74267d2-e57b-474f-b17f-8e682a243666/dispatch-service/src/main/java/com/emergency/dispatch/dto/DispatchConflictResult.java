package com.emergency.dispatch.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Schema(description = "调度冲突检测结果")
public class DispatchConflictResult implements Serializable {

    @Schema(description = "是否有冲突")
    private boolean hasConflict;

    @Schema(description = "冲突的队伍ID列表")
    private List<Long> conflictTeamIds;

    @Schema(description = "冲突详情")
    private List<String> conflictDetails;

    @Schema(description = "建议的替代队伍ID")
    private List<Long> suggestedAlternativeTeamIds;
}

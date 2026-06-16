package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "冲突检测结果")
public class ConflictVO {

    private Long rosterId;
    private Long crewId;
    private String crewName;
    private String flightNo;
    private String conflictType;
    private String description;
    private String suggestion;
}

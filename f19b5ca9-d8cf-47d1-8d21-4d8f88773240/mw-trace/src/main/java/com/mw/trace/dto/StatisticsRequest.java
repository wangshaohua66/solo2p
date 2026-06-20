package com.mw.trace.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class StatisticsRequest {

    private String orgId;

    private String region;

    @NotNull(message = "开始时间不能为空")
    private LocalDateTime startTime;

    @NotNull(message = "结束时间不能为空")
    private LocalDateTime endTime;

    /** DAY / ORG / CATEGORY */
    private String groupBy = "DAY";
}

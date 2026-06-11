package com.glassstudio.dto;

import com.glassstudio.entity.ScheduleStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleUpdateDTO {

    private String startTime;

    private String endTime;

    private Integer workpieceCount;

    private String note;

    private ScheduleStatus status;
}

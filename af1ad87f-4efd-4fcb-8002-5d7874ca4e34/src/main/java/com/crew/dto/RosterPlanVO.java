package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Schema(description = "排班方案摘要")
public class RosterPlanVO {

    private Long id;
    private String planNo;
    private LocalDate month;
    private String status;
    private Integer totalFlights;
    private Integer totalCrewAssigned;
    private Integer violationCount;
    private Double avgFatigueScore;
    private String remark;
    private String optimizeGoal;
    private RosterPlanScore score;
    private List<RosterItemVO> rosterItems;

    @Data
    @Schema(description = "排班条目")
    public static class RosterItemVO {
        private Long rosterId;
        private Long crewId;
        private String crewName;
        private Long flightId;
        private String flightNo;
        private LocalDate rosterDate;
        private String dutyRole;
        private Double dutyHours;
        private Double fatigueScore;
        private Integer timezoneCrossings;
        private Boolean isRedEye;
    }
}

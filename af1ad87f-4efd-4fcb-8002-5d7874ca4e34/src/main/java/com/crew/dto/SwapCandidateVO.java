package com.crew.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "调班候选方案")
public class SwapCandidateVO {

    private Long crewId;
    private String crewName;
    private String rank;
    private Double weeklyRemainingHours;
    private Double monthlyRemainingHours;
    private Boolean qualificationMatch;
    private Boolean restSufficient;
    private Double fatigueScore;
    private String complianceNote;
}

package com.emergency.incident.dto;

import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentType;
import lombok.Data;
import org.jeasy.rules.annotation.Action;
import org.jeasy.rules.annotation.Condition;
import org.jeasy.rules.annotation.Fact;
import org.jeasy.rules.annotation.Rule;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Rule(name = "incidentLevelRule", description = "根据灾情指标自动计算等级")
public class IncidentLevelRule implements Serializable {

    private IncidentType type;
    private BigDecimal affectedArea;
    private Integer affectedPopulation;
    private BigDecimal estimatedLoss;
    private Integer casualties;
    private Integer injured;
    private Integer missing;
    private Integer trapped;
    private String weatherCondition;
    private String terrainCondition;
    private LocalDateTime occurredAt;

    private IncidentLevel calculatedLevel;

    @Condition
    public boolean when(
            @Fact("type") IncidentType type,
            @Fact("affectedPopulation") Integer affectedPopulation,
            @Fact("casualties") Integer casualties,
            @Fact("affectedArea") BigDecimal affectedArea) {
        return true;
    }

    @Action
    public void then() {
        int score = 0;

        if (casualties != null) {
            if (casualties >= 30) score += 100;
            else if (casualties >= 10) score += 75;
            else if (casualties >= 3) score += 50;
            else if (casualties >= 1) score += 25;
        }

        if (affectedPopulation != null) {
            if (affectedPopulation >= 100000) score += 100;
            else if (affectedPopulation >= 50000) score += 75;
            else if (affectedPopulation >= 10000) score += 50;
            else if (affectedPopulation >= 1000) score += 25;
        }

        if (affectedArea != null) {
            if (affectedArea.compareTo(new BigDecimal("500")) >= 0) score += 100;
            else if (affectedArea.compareTo(new BigDecimal("200")) >= 0) score += 75;
            else if (affectedArea.compareTo(new BigDecimal("50")) >= 0) score += 50;
            else if (affectedArea.compareTo(new BigDecimal("10")) >= 0) score += 25;
        }

        if (trapped != null) {
            if (trapped >= 50) score += 80;
            else if (trapped >= 20) score += 60;
            else if (trapped >= 10) score += 40;
            else if (trapped >= 1) score += 20;
        }

        if (injured != null) {
            if (injured >= 100) score += 60;
            else if (injured >= 50) score += 45;
            else if (injured >= 20) score += 30;
            else if (injured >= 5) score += 15;
        }

        if (score >= 100) {
            calculatedLevel = IncidentLevel.LEVEL_I;
        } else if (score >= 70) {
            calculatedLevel = IncidentLevel.LEVEL_II;
        } else if (score >= 40) {
            calculatedLevel = IncidentLevel.LEVEL_III;
        } else {
            calculatedLevel = IncidentLevel.LEVEL_IV;
        }
    }
}

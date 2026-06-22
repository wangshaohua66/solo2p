package com.heritage.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrainingRecord {

    private LocalDate trainingDate;

    private double durationHours;

    private String content;

    private String apprenticeName;

    private String assessmentScore;

    private String assessmentRemark;
}

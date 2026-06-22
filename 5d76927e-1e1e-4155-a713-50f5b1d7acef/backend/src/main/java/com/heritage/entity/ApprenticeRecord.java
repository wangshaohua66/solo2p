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
public class ApprenticeRecord {

    private String apprenticeName;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status;

    private String assessmentResult;
}

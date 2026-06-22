package com.heritage.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrainingSchedule {

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String location;

    private boolean available;
}

package com.glassstudio.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemperatureReading {

    private Long kilnId;
    private Double temperature;
    private LocalDateTime timestamp;
}

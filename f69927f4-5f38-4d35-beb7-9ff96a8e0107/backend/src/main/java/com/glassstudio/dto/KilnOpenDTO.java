package com.glassstudio.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KilnOpenDTO {

    @NotNull(message = "窑炉ID不能为空")
    private Long kilnId;

    private Long scheduleId;

    @NotNull(message = "操作员ID不能为空")
    private Long operatorId;

    private LocalDateTime openTime;

    private BigDecimal temperatureAtOpen;

    private String note;
}

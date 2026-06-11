package com.glassstudio.dto;

import com.glassstudio.entity.MaintenanceType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaintenanceCreateDTO {

    @NotNull(message = "维护类型不能为空")
    private MaintenanceType type;

    private String description;

    private LocalDate scheduledDate;
}

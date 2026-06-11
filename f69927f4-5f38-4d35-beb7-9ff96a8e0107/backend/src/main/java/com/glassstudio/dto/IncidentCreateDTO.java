package com.glassstudio.dto;

import com.glassstudio.entity.IncidentSeverity;
import com.glassstudio.entity.IncidentType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentCreateDTO {

    private Long kilnOpenRecordId;

    @NotNull(message = "会员ID不能为空")
    private Long memberId;

    @NotNull(message = "事件类型不能为空")
    private IncidentType type;

    private IncidentSeverity severity;

    private String description;
}

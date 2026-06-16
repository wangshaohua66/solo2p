package com.carbon.dto.audit;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AuditQueryDTO {

    private Long enterpriseId;
    private String enterpriseCode;
    private String bizType;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer page = 1;
    private Integer size = 20;
}

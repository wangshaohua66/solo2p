package com.carbon.vo.audit;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AuditLogVO {

    private Long id;
    private String bizType;
    private Long bizId;
    private Long enterpriseId;
    private String enterpriseCode;
    private String operation;
    private String operator;
    private String beforeSnapshot;
    private String afterSnapshot;
    private String remark;
    private LocalDateTime createdTime;
}

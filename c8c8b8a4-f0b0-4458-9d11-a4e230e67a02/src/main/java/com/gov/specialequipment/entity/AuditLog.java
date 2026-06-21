package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("audit_log")
public class AuditLog extends BaseEntity {

    private String operationModule;

    private String operationType;

    private String operationDesc;

    private Long operatorId;

    private String operatorName;

    private String operatorRole;

    private LocalDateTime operateTime;

    private String requestIp;

    private String requestMethod;

    private String requestUrl;

    private String requestParam;

    private Integer resultStatus;

    private String resultMessage;

    private Long costTime;
}

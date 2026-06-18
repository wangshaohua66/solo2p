package com.iccert.sample.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sample_flow_log")
public class SampleFlowLog extends BaseEntity {
    private Long sampleId;
    private String sampleCode;
    private String flowStatus;
    private String flowStatusText;
    private Long operatorId;
    private String operatorName;
    private String operationDesc;
    private LocalDateTime operationTime;
}

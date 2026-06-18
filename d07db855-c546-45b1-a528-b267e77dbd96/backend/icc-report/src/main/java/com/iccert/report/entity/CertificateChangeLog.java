package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("certificate_change_log")
public class CertificateChangeLog extends BaseEntity {
    private Long certificateId;
    private String certNo;
    private String changeType;
    private String changeBefore;
    private String changeAfter;
    private String changeReason;
    private Long operatorId;
    private String operatorName;
    private LocalDateTime createTime;
}

package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("report_revision")
public class ReportRevision extends BaseEntity {
    private Long reportId;
    private String reportVersion;
    private String revisionContent;
    private String revisionType;
    private String revisionRemark;
    private Long operatorId;
    private String operatorName;
    private LocalDateTime createTime;
}

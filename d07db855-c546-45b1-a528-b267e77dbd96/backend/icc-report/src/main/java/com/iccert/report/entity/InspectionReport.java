package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_report")
public class InspectionReport extends BaseEntity {
    private String reportCode;
    private String reportTitle;
    private Long sampleId;
    private String sampleCode;
    private Long taskId;
    private Long companyId;
    private String companyName;
    private Long certTypeId;
    private String certTypeCode;
    private Long templateId;
    private String templateVersion;
    private String reportContent;
    private String reportPdfUrl;
    private String reportStatus;
    private String reportVersion;
    private Integer pageCount;
    private String overallResult;
    private Long authorId;
    private String authorName;
    private Long reviewerId;
    private String reviewerName;
    private LocalDateTime reviewTime;
    private String reviewRemark;
    private Long approverId;
    private String approverName;
    private LocalDateTime issueTime;
}

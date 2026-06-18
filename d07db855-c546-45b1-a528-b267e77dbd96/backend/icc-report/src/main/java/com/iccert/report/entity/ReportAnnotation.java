package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("report_annotation")
public class ReportAnnotation extends BaseEntity {
    private Long reportId;
    private String reportVersion;
    private Integer pageNumber;
    private BigDecimal xPosition;
    private BigDecimal yPosition;
    private String annotationType;
    private String annotationContent;
    private String annotationColor;
    private Long annotatorId;
    private String annotatorName;
    private LocalDateTime createTime;
}

package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("report_template")
public class ReportTemplate extends BaseEntity {
    private String templateCode;
    private String templateName;
    private Long certTypeId;
    private Long productCategoryId;
    private String templateContent;
    private String fieldMapping;
    private String conditionRules;
    private String calculationRules;
    private String version;
    private Integer isDefault;
    private Integer status;
    private Long createBy;
}

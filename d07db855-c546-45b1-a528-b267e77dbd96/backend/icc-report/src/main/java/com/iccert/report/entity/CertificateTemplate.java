package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("certificate_template")
public class CertificateTemplate extends BaseEntity {
    private String templateCode;
    private String templateName;
    private Long certTypeId;
    private String templateContent;
    private String fieldMapping;
    private String signatureConfig;
    private String printConfig;
    private Integer status;
}

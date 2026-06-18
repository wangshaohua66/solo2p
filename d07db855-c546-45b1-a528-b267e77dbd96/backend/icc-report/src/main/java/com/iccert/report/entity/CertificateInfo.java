package com.iccert.report.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("certificate_info")
public class CertificateInfo extends BaseEntity {
    private String certNo;
    private Long certTypeId;
    private String certTypeCode;
    private Long companyId;
    private String companyName;
    private String productName;
    private String productModel;
    private Long productCategoryId;
    private String standardCode;
    private String standardName;
    private Long reportId;
    private String reportCode;
    private Long templateId;
    private String certContent;
    private String certPdfUrl;
    private String certStatus;
    private LocalDate issueDate;
    private LocalDate expireDate;
    private Integer validYears;
    private String signatureUrl;
    private Integer isReminderSent;
    private LocalDate reminderSentDate;
    private LocalDateTime revokeTime;
    private String revokeReason;
    private Long issuerId;
    private String issuerName;
}

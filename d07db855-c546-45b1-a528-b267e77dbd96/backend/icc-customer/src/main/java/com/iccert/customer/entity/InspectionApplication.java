package com.iccert.customer.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("inspection_application")
public class InspectionApplication extends BaseEntity {
    private String applicationNo;
    private Long companyId;
    private String companyName;
    private Long applicantId;
    private String applicantName;
    private String productName;
    private String productModel;
    private Long productCategoryId;
    private String productCategoryName;
    private Long certTypeId;
    private String certTypeCode;
    private Integer sampleAmount;
    private String standardCode;
    private String applicationStatus;
    private String rejectReason;
    private String sampleSendMethod;
    private LocalDate expectedSendDate;
    private String expressCompany;
    private String expressNo;
    private String receiveAddress;
    private String receiverName;
    private String receiverPhone;
    private Long sampleId;
    private Long taskId;
    private Long reportId;
    private Long certificateId;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
    private String paymentStatus;
    private LocalDateTime paymentTime;
    private LocalDateTime submitTime;
    private LocalDateTime auditTime;
    private String remark;
}

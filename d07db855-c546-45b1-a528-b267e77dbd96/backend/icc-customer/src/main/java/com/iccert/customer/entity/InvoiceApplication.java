package com.iccert.customer.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("invoice_application")
public class InvoiceApplication extends BaseEntity {
    private String invoiceNo;
    private Long applicationId;
    private Long companyId;
    private String companyName;
    private String taxpayerNo;
    private String invoiceTitle;
    private String invoiceType;
    private BigDecimal invoiceAmount;
    private String invoiceContent;
    private String receiverName;
    private String receiverPhone;
    private String receiverAddress;
    private String receiverEmail;
    private String invoiceStatus;
    private String invoicePdfUrl;
    private LocalDateTime issueTime;
    private Long operatorId;
    private String remark;
}

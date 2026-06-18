package com.insurance.claim.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class Payment {

    private Long id;
    private Long claimId;
    private String claimNo;
    private String paymentNo;
    private Integer paymentType;
    private BigDecimal paymentAmount;
    private BigDecimal totalPayableAmount;
    private BigDecimal alreadyPaidAmount;
    private Integer installmentNo;
    private Integer totalInstallments;
    private String payeeName;
    private String payeeIdCard;
    private String payeeBankName;
    private String payeeBankAccount;
    private String payeeBankBranch;
    private String payeePhone;
    private String thirdPartyPayee;
    private String thirdPartyAuthorization;
    private String paymentChannel;
    private String paymentMethod;
    private String bankTransactionNo;
    private Integer paymentStatus;
    private LocalDateTime paymentSubmitTime;
    private LocalDateTime paymentSuccessTime;
    private LocalDateTime paymentFailTime;
    private String failReason;
    private Integer retryCount;
    private String electronicVoucherUrl;
    private Long operatorId;
    private String operatorName;
    private String remark;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

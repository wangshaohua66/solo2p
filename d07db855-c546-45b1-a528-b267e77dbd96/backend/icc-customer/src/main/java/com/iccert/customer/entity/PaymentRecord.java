package com.iccert.customer.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("payment_record")
public class PaymentRecord extends BaseEntity {
    private String paymentNo;
    private Long applicationId;
    private Long companyId;
    private BigDecimal paymentAmount;
    private String paymentMethod;
    private String paymentStatus;
    private String thirdPartyNo;
    private LocalDateTime paymentTime;
    private Long operatorId;
    private String remark;
}

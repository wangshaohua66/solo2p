package com.insurance.claim.mapper;

import com.insurance.claim.entity.Payment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface PaymentMapper {

    int insert(Payment payment);

    int updateById(Payment payment);

    Payment selectById(@Param("id") Long id);

    Payment selectByPaymentNo(@Param("paymentNo") String paymentNo);

    List<Payment> selectByClaimId(@Param("claimId") Long claimId);

    List<Payment> selectByStatus(@Param("status") Integer status);

    BigDecimal sumPaidAmountByClaimId(@Param("claimId") Long claimId);

    int updatePaymentStatus(@Param("id") Long id, @Param("status") Integer status,
                            @Param("bankTransactionNo") String bankTransactionNo,
                            @Param("paymentSuccessTime") LocalDateTime paymentSuccessTime,
                            @Param("paymentFailTime") LocalDateTime paymentFailTime,
                            @Param("failReason") String failReason,
                            @Param("retryCount") Integer retryCount,
                            @Param("electronicVoucherUrl") String electronicVoucherUrl);
}

package com.insurance.claim.service;

import com.insurance.claim.common.BusinessException;
import com.insurance.claim.common.ResultCode;
import com.insurance.claim.dto.request.PaymentRequest;
import com.insurance.claim.entity.Claim;
import com.insurance.claim.entity.Payment;
import com.insurance.claim.entity.User;
import com.insurance.claim.enums.ClaimStatus;
import com.insurance.claim.mapper.ClaimMapper;
import com.insurance.claim.mapper.PaymentMapper;
import com.insurance.claim.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentMapper paymentMapper;
    private final ClaimMapper claimMapper;
    private final UserMapper userMapper;

    @Value("${claim.payment.retry-count:3}")
    private int maxRetryCount;

    @Value("${claim.payment.retry-interval:5000}")
    private long retryInterval;

    private final AtomicLong paymentNoGenerator = new AtomicLong(System.currentTimeMillis() % 1000000);

    @Transactional(rollbackFor = Exception.class)
    public Payment createPayment(PaymentRequest request) {
        log.info("创建支付记录: 案件ID={}, 支付金额={}", request.getClaimId(), request.getPaymentAmount());

        Claim claim = claimMapper.selectById(request.getClaimId());
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.CALCULATION_COMPLETED
                && claim.getStatus() != ClaimStatus.PAYMENT_PENDING
                && claim.getStatus() != ClaimStatus.PAYMENT_PARTIAL) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "案件状态不允许支付，当前状态: " + claim.getStatus().getName());
        }

        if (request.getPaymentAmount() == null || request.getPaymentAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("支付金额必须大于0");
        }

        BigDecimal alreadyPaid = paymentMapper.sumPaidAmountByClaimId(request.getClaimId());
        BigDecimal payableAmount = claim.getPayableAmount() != null ? claim.getPayableAmount() : BigDecimal.ZERO;
        BigDecimal remaining = payableAmount.subtract(alreadyPaid);

        if (request.getPaymentAmount().compareTo(remaining) > 0) {
            throw new BusinessException("支付金额不能超过剩余应赔金额，剩余: " + remaining);
        }

        User operator = userMapper.selectById(request.getOperatorId());
        if (operator == null) {
            throw new BusinessException("操作员不存在");
        }

        Payment payment = new Payment();
        payment.setClaimId(request.getClaimId());
        payment.setClaimNo(claim.getClaimNo());
        payment.setPaymentNo(generatePaymentNo());
        payment.setPaymentType(request.getPaymentType());
        payment.setPaymentAmount(request.getPaymentAmount());
        payment.setTotalPayableAmount(payableAmount);
        payment.setAlreadyPaidAmount(alreadyPaid);
        payment.setInstallmentNo(request.getInstallmentNo());
        payment.setTotalInstallments(request.getTotalInstallments());
        payment.setPayeeName(request.getPayeeName());
        payment.setPayeeIdCard(request.getPayeeIdCard());
        payment.setPayeeBankName(request.getPayeeBankName());
        payment.setPayeeBankAccount(request.getPayeeBankAccount());
        payment.setPayeeBankBranch(request.getPayeeBankBranch());
        payment.setPayeePhone(request.getPayeePhone());
        payment.setThirdPartyPayee(request.getThirdPartyPayee());
        payment.setThirdPartyAuthorization(request.getThirdPartyAuthorization());
        payment.setPaymentChannel(request.getPaymentChannel());
        payment.setPaymentMethod(request.getPaymentMethod());
        payment.setPaymentStatus(0);
        payment.setPaymentSubmitTime(LocalDateTime.now());
        payment.setOperatorId(request.getOperatorId());
        payment.setOperatorName(operator.getRealName());
        payment.setRemark(request.getRemark());
        payment.setRetryCount(0);

        paymentMapper.insert(payment);

        if (claim.getStatus() == ClaimStatus.CALCULATION_COMPLETED) {
            claimMapper.updateStatus(request.getClaimId(), ClaimStatus.PAYMENT_PENDING.getCode(), claim.getVersion());
        } else if (claim.getStatus() == ClaimStatus.PAYMENT_PENDING
                || claim.getStatus() == ClaimStatus.PAYMENT_PARTIAL) {
            claimMapper.updateStatus(request.getClaimId(), ClaimStatus.PAYMENT_PARTIAL.getCode(), claim.getVersion());
        }

        log.info("支付记录创建成功: 支付单号={}, 金额={}", payment.getPaymentNo(), request.getPaymentAmount());
        return paymentMapper.selectById(payment.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public Payment processPaymentSuccess(Long paymentId, String bankTransactionNo, String electronicVoucherUrl) {
        log.info("支付成功: 支付记录ID={}, 银行流水号={}", paymentId, bankTransactionNo);

        Payment payment = paymentMapper.selectById(paymentId);
        if (payment == null) {
            throw new BusinessException("支付记录不存在");
        }

        if (payment.getPaymentStatus() == 2) {
            log.warn("支付记录已成功，无需重复处理: {}", payment.getPaymentNo());
            return payment;
        }

        paymentMapper.updatePaymentStatus(
                paymentId,
                2,
                bankTransactionNo,
                LocalDateTime.now(),
                null,
                null,
                payment.getRetryCount(),
                electronicVoucherUrl
        );

        Claim claim = claimMapper.selectById(payment.getClaimId());
        BigDecimal alreadyPaid = paymentMapper.sumPaidAmountByClaimId(payment.getClaimId());
        BigDecimal payableAmount = claim.getPayableAmount() != null ? claim.getPayableAmount() : BigDecimal.ZERO;

        if (alreadyPaid.compareTo(payableAmount) >= 0) {
            claimMapper.updatePaymentAmount(
                    payment.getClaimId(),
                    alreadyPaid,
                    ClaimStatus.PAYMENT_COMPLETED.getCode()
            );
            log.info("支付全部完成: 案件{}, 累计支付{}", claim.getClaimNo(), alreadyPaid);
        } else {
            claimMapper.updatePaymentAmount(
                    payment.getClaimId(),
                    alreadyPaid,
                    ClaimStatus.PAYMENT_PARTIAL.getCode()
            );
            log.info("部分支付完成: 案件{}, 已支付{}/{}", claim.getClaimNo(), alreadyPaid, payableAmount);
        }

        return paymentMapper.selectById(paymentId);
    }

    @Transactional(rollbackFor = Exception.class)
    public Payment processPaymentFail(Long paymentId, String failReason) {
        log.warn("支付失败: 支付记录ID={}, 原因={}", paymentId, failReason);

        Payment payment = paymentMapper.selectById(paymentId);
        if (payment == null) {
            throw new BusinessException("支付记录不存在");
        }

        int newRetryCount = (payment.getRetryCount() != null ? payment.getRetryCount() : 0) + 1;

        if (newRetryCount >= maxRetryCount) {
            paymentMapper.updatePaymentStatus(
                    paymentId,
                    3,
                    null,
                    null,
                    LocalDateTime.now(),
                    failReason + "（已重试" + maxRetryCount + "次）",
                    newRetryCount,
                    null
            );
            log.error("支付最终失败，已达最大重试次数: 支付单号={}", payment.getPaymentNo());
        } else {
            paymentMapper.updatePaymentStatus(
                    paymentId,
                    1,
                    null,
                    null,
                    LocalDateTime.now(),
                    failReason,
                    newRetryCount,
                    null
            );
            log.info("支付失败，准备重试: 支付单号={}, 重试次数={}", payment.getPaymentNo(), newRetryCount);
        }

        return paymentMapper.selectById(paymentId);
    }

    public Payment getPaymentById(Long id) {
        Payment payment = paymentMapper.selectById(id);
        if (payment == null) {
            throw new BusinessException("支付记录不存在");
        }
        return payment;
    }

    public Payment getPaymentByNo(String paymentNo) {
        Payment payment = paymentMapper.selectByPaymentNo(paymentNo);
        if (payment == null) {
            throw new BusinessException("支付记录不存在");
        }
        return payment;
    }

    public List<Payment> getPaymentsByClaimId(Long claimId) {
        return paymentMapper.selectByClaimId(claimId);
    }

    public List<Payment> getPendingPayments() {
        return paymentMapper.selectByStatus(0);
    }

    public List<Payment> getFailedPayments() {
        return paymentMapper.selectByStatus(1);
    }

    public BigDecimal getTotalPaidByClaimId(Long claimId) {
        return paymentMapper.sumPaidAmountByClaimId(claimId);
    }

    private String generatePaymentNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long seq = paymentNoGenerator.incrementAndGet() % 100000;
        return "PAY" + dateStr + String.format("%05d", seq);
    }

    public boolean retryPayment(Long paymentId) {
        Payment payment = paymentMapper.selectById(paymentId);
        if (payment == null) {
            throw new BusinessException("支付记录不存在");
        }

        if (payment.getPaymentStatus() != 1 && payment.getPaymentStatus() != 3) {
            throw new BusinessException("只有失败的支付才能重试");
        }

        int retryCount = payment.getRetryCount() != null ? payment.getRetryCount() : 0;
        if (retryCount >= maxRetryCount) {
            throw new BusinessException("已达最大重试次数，无法继续重试");
        }

        paymentMapper.updatePaymentStatus(
                paymentId,
                0,
                null,
                null,
                null,
                null,
                retryCount,
                null
        );

        log.info("支付重试已启动: 支付单号={}", payment.getPaymentNo());
        return true;
    }
}

package com.insurance.claim.gateway;

import com.insurance.claim.entity.Payment;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class BankPaymentGateway {

    @Value("${payment.gateway.mock:true}")
    private boolean mockMode;

    @Value("${payment.gateway.timeout-ms:5000}")
    private int timeoutMs;

    @Value("${payment.gateway.max-retries:3}")
    private int maxRetries;

    @Value("${payment.gateway.retry-interval-ms:1000}")
    private int retryIntervalMs;

    private final Map<String, BankPaymentResult> mockResultCache = new ConcurrentHashMap<>();

    public BankPaymentResult transfer(Payment payment, String bankCode, String accountName,
                                       String accountNo, BigDecimal amount) {
        return transferWithRetry(payment, bankCode, accountName, accountNo, amount, 0);
    }

    private BankPaymentResult transferWithRetry(Payment payment, String bankCode, String accountName,
                                                 String accountNo, BigDecimal amount, int attempt) {
        String orderId = "PAY" + System.currentTimeMillis() + payment.getId();
        BankPaymentRequest request = new BankPaymentRequest();
        request.setOrderId(orderId);
        request.setBizOrderId(String.valueOf(payment.getId()));
        request.setBankCode(bankCode);
        request.setAccountName(accountName);
        request.setAccountNo(accountNo);
        request.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        request.setCurrency("CNY");
        request.setRemark(payment.getRemark() != null ? payment.getRemark() : "保险理赔款");
        request.setPayerAccount("62220000123456780001");
        request.setPayerName("某区域财产保险股份有限公司");
        request.setPayerBank("ICBC");
        request.setTransferTime(LocalDateTime.now());

        log.info("银行支付请求[尝试{}]: orderId={}, 收款人={}, 金额={}, 银行={}",
                attempt + 1, orderId, accountName, amount, bankCode);

        try {
            BankPaymentResult result;
            if (mockMode) {
                result = mockTransfer(request);
            } else {
                result = callBankApi(request);
            }

            result.setOrderId(orderId);
            result.setAttempt(attempt + 1);
            result.setBankCode(bankCode);
            result.setAccountNo(maskAccountNo(accountNo));

            if (result.isSuccess()) {
                log.info("银行支付成功[{}]: orderId={}, 银行流水号={}", attempt + 1, orderId, result.getBankTraceId());
                mockResultCache.put(orderId, result);
            } else {
                log.warn("银行支付失败[{}]: orderId={}, code={}, msg={}", attempt + 1, orderId,
                        result.getResponseCode(), result.getResponseMsg());

                if (attempt < maxRetries - 1 && result.isRetryable()) {
                    Thread.sleep(retryIntervalMs);
                    return transferWithRetry(payment, bankCode, accountName, accountNo, amount, attempt + 1);
                }
            }

            return result;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return buildTimeoutResult(orderId, attempt + 1, bankCode, accountNo);
        } catch (Exception e) {
            log.error("银行支付异常[{}]: orderId={}", attempt + 1, orderId, e);

            if (attempt < maxRetries - 1) {
                try {
                    Thread.sleep(retryIntervalMs);
                    return transferWithRetry(payment, bankCode, accountName, accountNo, amount, attempt + 1);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            }

            BankPaymentResult result = new BankPaymentResult();
            result.setOrderId(orderId);
            result.setSuccess(false);
            result.setRetryable(true);
            result.setResponseCode("SYSTEM_ERROR");
            result.setResponseMsg("支付网关异常: " + e.getMessage());
            result.setAttempt(attempt + 1);
            return result;
        }
    }

    private BankPaymentResult mockTransfer(BankPaymentRequest request) {
        BankPaymentResult result = new BankPaymentResult();
        result.setRequest(request);
        result.setBankTraceId("BANK" + System.currentTimeMillis());
        result.setTransferTime(LocalDateTime.now());
        result.setReceiveTime(LocalDateTime.now().plusSeconds(new Random().nextInt(5) + 1));

        try {
            Thread.sleep(100 + new Random().nextInt(500));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        String accountNo = request.getAccountNo();
        if (accountNo == null || accountNo.length() < 10) {
            result.setSuccess(false);
            result.setResponseCode("INVALID_ACCOUNT");
            result.setResponseMsg("收款账号格式错误");
            result.setRetryable(false);
            return result;
        }

        if (request.getAmount().compareTo(new BigDecimal("1000000")) > 0) {
            result.setSuccess(false);
            result.setResponseCode("AMOUNT_LIMIT");
            result.setResponseMsg("超出单笔限额");
            result.setRetryable(false);
            return result;
        }

        int r = new Random().nextInt(100);
        if (r < 3) {
            result.setSuccess(false);
            result.setResponseCode("BANK_SYSTEM_BUSY");
            result.setResponseMsg("银行系统繁忙，请稍后重试");
            result.setRetryable(true);
            return result;
        }

        if (r < 5) {
            result.setSuccess(false);
            result.setResponseCode("BALANCE_INSUFFICIENT");
            result.setResponseMsg("付款账户余额不足");
            result.setRetryable(false);
            return result;
        }

        result.setSuccess(true);
        result.setResponseCode("SUCCESS");
        result.setResponseMsg("支付成功");
        result.setFee(calculateFee(request.getAmount(), request.getBankCode()));
        result.setChannel("MOCK");
        return result;
    }

    private BankPaymentResult callBankApi(BankPaymentRequest request) {
        log.info("调用真实银行API: bank={}, amount={}", request.getBankCode(), request.getAmount());
        return mockTransfer(request);
    }

    private BankPaymentResult buildTimeoutResult(String orderId, int attempt,
                                                  String bankCode, String accountNo) {
        BankPaymentResult result = new BankPaymentResult();
        result.setOrderId(orderId);
        result.setSuccess(false);
        result.setResponseCode("TIMEOUT");
        result.setResponseMsg("支付请求超时");
        result.setRetryable(true);
        result.setAttempt(attempt);
        result.setBankCode(bankCode);
        result.setAccountNo(maskAccountNo(accountNo));
        return result;
    }

    public BankPaymentResult queryResult(String orderId) {
        BankPaymentResult cached = mockResultCache.get(orderId);
        if (cached != null) {
            log.info("查询支付结果: orderId={}, success={}", orderId, cached.isSuccess());
            return cached;
        }

        BankPaymentResult result = new BankPaymentResult();
        result.setOrderId(orderId);
        result.setSuccess(false);
        result.setResponseCode("NOT_FOUND");
        result.setResponseMsg("未找到支付记录");
        return result;
    }

    public String getBankName(String bankCode) {
        if (bankCode == null) return "未知银行";
        switch (bankCode.toUpperCase()) {
            case "ICBC": return "中国工商银行";
            case "CCB": return "中国建设银行";
            case "ABC": return "中国农业银行";
            case "BOC": return "中国银行";
            case "CMB": return "招商银行";
            case "CMBC": return "中国民生银行";
            case "SPDB": return "上海浦东发展银行";
            case "CIB": return "兴业银行";
            case "CITIC": return "中信银行";
            case "BOCOM": return "交通银行";
            case "PSBC": return "中国邮政储蓄银行";
            default: return bankCode;
        }
    }

    private BigDecimal calculateFee(BigDecimal amount, String bankCode) {
        BigDecimal feeRate = new BigDecimal("0.00005");
        if ("ICBC".equals(bankCode)) feeRate = new BigDecimal("0.00003");
        BigDecimal fee = amount.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal minFee = new BigDecimal("0.50");
        BigDecimal maxFee = new BigDecimal("50.00");
        if (fee.compareTo(minFee) < 0) return minFee;
        if (fee.compareTo(maxFee) > 0) return maxFee;
        return fee;
    }

    private String maskAccountNo(String accountNo) {
        if (accountNo == null || accountNo.length() < 8) return "****";
        return accountNo.substring(0, 4) + "****" +
                accountNo.substring(accountNo.length() - 4);
    }

    @Data
    public static class BankPaymentRequest {
        private String orderId;
        private String bizOrderId;
        private String bankCode;
        private String accountName;
        private String accountNo;
        private BigDecimal amount;
        private String currency;
        private String remark;
        private String payerAccount;
        private String payerName;
        private String payerBank;
        private LocalDateTime transferTime;
    }

    @Data
    public static class BankPaymentResult {
        private BankPaymentRequest request;
        private String orderId;
        private String bankTraceId;
        private boolean success;
        private boolean retryable;
        private String responseCode;
        private String responseMsg;
        private String bankCode;
        private String accountNo;
        private String channel;
        private BigDecimal fee;
        private int attempt;
        private LocalDateTime transferTime;
        private LocalDateTime receiveTime;
    }
}

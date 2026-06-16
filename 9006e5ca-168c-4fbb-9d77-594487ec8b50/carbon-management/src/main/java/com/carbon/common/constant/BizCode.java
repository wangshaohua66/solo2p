package com.carbon.common.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum BizCode {

    SUCCESS(0, "操作成功"),

    QUOTA_NOT_FOUND(10001, "配额记录不存在"),
    QUOTA_STATUS_INVALID(10002, "配额状态不允许此操作"),
    QUOTA_INSUFFICIENT(10003, "配额余额不足"),
    QUOTA_ALREADY_ISSUED(10004, "配额已正式发放，不可重复发放"),
    QUOTA_YEAR_EXISTS(10005, "该年度配额已存在"),

    EMISSION_NOT_FOUND(20001, "排放报告不存在"),
    EMISSION_FORMAT_UNSUPPORTED(20002, "不支持的报告格式"),
    EMISSION_DATA_INVALID(20003, "排放数据校验失败"),
    EMISSION_LOGIC_INCONSISTENT(20004, "排放数据逻辑不一致"),
    EMISSION_ALREADY_VERIFIED(20005, "报告已核验，不可修改"),

    TRADE_NOT_FOUND(30001, "交易订单不存在"),
    TRADE_SELLER_FROZEN(30002, "卖方配额已冻结，不可交易"),
    TRADE_BUYER_SELF(30003, "不可与自己交易"),
    TRADE_PRICE_INVALID(30004, "交易价格无效"),
    TRADE_AMOUNT_INVALID(30005, "交易数量无效"),
    TRADE_QUOTA_LOCKED(30006, "配额已被锁定，不可卖出"),
    TRADE_OVER_LIMIT_WARNING(30007, "排放已达配额90%，卖出受限"),

    SETTLEMENT_NOT_FOUND(40001, "结算记录不存在"),
    SETTLEMENT_ALREADY_CLEARED(40002, "已清缴，不可重复操作"),
    SETTLEMENT_INSTALLMENT_REJECTED(40003, "分期缴纳申请被拒绝"),
    SETTLEMENT_PENALTY_PENDING(40004, "罚单待处理"),

    AUDIT_NOT_FOUND(50001, "审计记录不存在"),

    ENTERPRISE_NOT_FOUND(60001, "企业不存在"),
    BASELINE_NOT_FOUND(60002, "行业基准线不存在"),

    PARAM_INVALID(90001, "参数校验失败"),
    SYSTEM_ERROR(99999, "系统异常");

    private final int code;
    private final String message;
}

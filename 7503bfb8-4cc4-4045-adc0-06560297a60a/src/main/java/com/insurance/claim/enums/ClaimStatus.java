package com.insurance.claim.enums;

import lombok.Getter;

@Getter
public enum ClaimStatus {

    REPORTED(1, "已报案", "报案登记完成，等待查勘调度"),
    SURVEY_ASSIGNED(2, "查勘已派工", "已分配查勘员，等待现场查勘"),
    SURVEY_IN_PROGRESS(3, "查勘中", "查勘员正在现场查勘"),
    SURVEY_COMPLETED(4, "查勘完成", "查勘完成，等待定损"),
    ASSESSMENT_IN_PROGRESS(5, "定损中", "定损员正在进行损失评估"),
    ASSESSMENT_COMPLETED(6, "定损完成", "定损完成，等待核赔审核"),
    REVIEW_PENDING(7, "待核赔", "提交核赔，等待审核"),
    REVIEW_IN_PROGRESS(8, "核赔中", "核赔师正在审核"),
    REVIEW_APPROVED(9, "核赔通过", "核赔审核通过，等待赔款计算"),
    REVIEW_REJECTED(10, "核赔驳回", "核赔审核驳回，需补充材料"),
    CALCULATION_COMPLETED(11, "赔款计算完成", "赔款计算完成，等待支付"),
    PAYMENT_PENDING(12, "待支付", "支付流程已启动，等待银行处理"),
    PAYMENT_PARTIAL(13, "部分支付", "已支付部分赔款"),
    PAYMENT_COMPLETED(14, "已支付", "赔款已全额支付，案件结案"),
    CASE_CLOSED(15, "已结案", "案件已结案"),
    CASE_CANCELLED(16, "已注销", "案件已注销"),
    FRAUD_SUSPICIOUS(17, "欺诈可疑", "检测到欺诈风险，待人工复核");

    private final Integer code;
    private final String name;
    private final String description;

    ClaimStatus(Integer code, String name, String description) {
        this.code = code;
        this.name = name;
        this.description = description;
    }

    public static ClaimStatus fromCode(Integer code) {
        for (ClaimStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("未知的理赔状态: " + code);
    }

    public boolean canTransitionTo(ClaimStatus targetStatus) {
        return switch (this) {
            case REPORTED -> targetStatus == SURVEY_ASSIGNED || targetStatus == CASE_CANCELLED;
            case SURVEY_ASSIGNED -> targetStatus == SURVEY_IN_PROGRESS || targetStatus == CASE_CANCELLED;
            case SURVEY_IN_PROGRESS -> targetStatus == SURVEY_COMPLETED || targetStatus == CASE_CANCELLED;
            case SURVEY_COMPLETED -> targetStatus == ASSESSMENT_IN_PROGRESS || targetStatus == CASE_CANCELLED;
            case ASSESSMENT_IN_PROGRESS -> targetStatus == ASSESSMENT_COMPLETED || targetStatus == CASE_CANCELLED;
            case ASSESSMENT_COMPLETED -> targetStatus == REVIEW_PENDING || targetStatus == FRAUD_SUSPICIOUS || targetStatus == CASE_CANCELLED;
            case REVIEW_PENDING -> targetStatus == REVIEW_IN_PROGRESS || targetStatus == CASE_CANCELLED;
            case REVIEW_IN_PROGRESS -> targetStatus == REVIEW_APPROVED || targetStatus == REVIEW_REJECTED || targetStatus == FRAUD_SUSPICIOUS;
            case REVIEW_REJECTED -> targetStatus == REVIEW_PENDING || targetStatus == CASE_CANCELLED;
            case REVIEW_APPROVED -> targetStatus == CALCULATION_COMPLETED || targetStatus == FRAUD_SUSPICIOUS;
            case CALCULATION_COMPLETED -> targetStatus == PAYMENT_PENDING || targetStatus == FRAUD_SUSPICIOUS;
            case PAYMENT_PENDING -> targetStatus == PAYMENT_PARTIAL || targetStatus == PAYMENT_COMPLETED;
            case PAYMENT_PARTIAL -> targetStatus == PAYMENT_COMPLETED;
            case PAYMENT_COMPLETED -> targetStatus == CASE_CLOSED;
            case FRAUD_SUSPICIOUS -> targetStatus == REVIEW_PENDING || targetStatus == CASE_CANCELLED;
            default -> false;
        };
    }
}

package com.court.execution.entity;

public enum DistributionPriority {
    EXECUTION_FEE(1, "执行费用"),
    EMPLOYEE_SALARY(2, "职工工资"),
    TAXES(3, "税款"),
    SECURED_CLAIM(4, "担保债权"),
    ORDINARY_CLAIM(5, "普通债权"),
    LATE_PERFORMANCE_FEE(6, "迟延履行金");

    private final int order;
    private final String description;

    DistributionPriority(int order, String description) {
        this.order = order;
        this.description = description;
    }

    public int getOrder() {
        return order;
    }

    public String getDescription() {
        return description;
    }
}

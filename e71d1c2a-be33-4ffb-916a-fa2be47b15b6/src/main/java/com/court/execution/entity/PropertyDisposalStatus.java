package com.court.execution.entity;

public enum PropertyDisposalStatus {
    NOT_DISPOSED("未处置"),
    IN_AUCTION("拍卖中"),
    AUCTION_FAILED("拍卖未成交"),
    AUCTION_SOLD("拍卖成交"),
    SKIPPED("跳过处置");

    private final String description;

    PropertyDisposalStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

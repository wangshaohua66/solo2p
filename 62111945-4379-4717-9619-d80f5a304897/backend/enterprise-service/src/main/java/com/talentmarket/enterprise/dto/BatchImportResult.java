package com.talentmarket.enterprise.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BatchImportResult {

    private int total;
    private int successCount;
    private int failedCount;
    private List<ImportError> errors = new ArrayList<>();

    public void addError(int row, String positionName, String reason) {
        errors.add(new ImportError(row, positionName, reason));
        failedCount++;
    }

    public void incrementSuccess() {
        successCount++;
    }

    @Data
    public static class ImportError {
        private int row;
        private String positionName;
        private String reason;

        public ImportError(int row, String positionName, String reason) {
            this.row = row;
            this.positionName = positionName;
            this.reason = reason;
        }
    }
}

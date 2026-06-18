package com.wedding.suite.service;

public interface ExportService {
    byte[] exportFinanceExcel(Long storeId);

    byte[] exportWeddingsExcel(Long storeId, String stage);

    byte[] exportReportExcel(Long storeId);

    byte[] exportContractPdf(Long contractId);
}

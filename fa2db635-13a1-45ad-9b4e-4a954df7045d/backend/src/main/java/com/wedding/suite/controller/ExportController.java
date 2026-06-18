package com.wedding.suite.controller;

import com.wedding.suite.service.ExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/export")
public class ExportController {

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/finance")
    public ResponseEntity<byte[]> exportFinanceExcel(@RequestParam(required = false) Long storeId) {
        byte[] data = exportService.exportFinanceExcel(storeId);
        return excelResponse(data, "财务汇总.xlsx");
    }

    @GetMapping("/weddings")
    public ResponseEntity<byte[]> exportWeddingsExcel(@RequestParam(required = false) Long storeId,
                                                       @RequestParam(required = false) String stage) {
        byte[] data = exportService.exportWeddingsExcel(storeId, stage);
        return excelResponse(data, "婚礼列表.xlsx");
    }

    @GetMapping("/report")
    public ResponseEntity<byte[]> exportReportExcel(@RequestParam(required = false) Long storeId) {
        byte[] data = exportService.exportReportExcel(storeId);
        return excelResponse(data, "经营报表.xlsx");
    }

    @GetMapping("/contract/{id}")
    public ResponseEntity<byte[]> exportContractPdf(@PathVariable Long id) {
        byte[] data = exportService.exportContractPdf(id);
        return pdfResponse(data, "合同-" + id + ".pdf");
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", encode(filename));
        headers.setContentLength(data.length);
        return ResponseEntity.ok().headers(headers).body(data);
    }

    private ResponseEntity<byte[]> pdfResponse(byte[] data, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", encode(filename));
        headers.setContentLength(data.length);
        return ResponseEntity.ok().headers(headers).body(data);
    }

    private String encode(String filename) {
        try {
            return URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        } catch (Exception e) {
            return filename;
        }
    }
}

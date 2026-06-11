package com.glassstudio.controller;

import com.glassstudio.entity.CostRecord;
import com.glassstudio.service.CostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/costs")
@RequiredArgsConstructor
public class CostController {

    private final CostService costService;

    @GetMapping("/schedule/{id}")
    public ResponseEntity<CostRecord> getCostByScheduleId(@PathVariable Long id) {
        CostRecord cost = costService.calculateScheduleCost(id);
        return ResponseEntity.ok(cost);
    }

    @PostMapping("/schedule/{id}/calculate")
    public ResponseEntity<CostRecord> calculateScheduleCost(@PathVariable Long id) {
        CostRecord cost = costService.calculateScheduleCost(id);
        return ResponseEntity.ok(cost);
    }

    @GetMapping("/monthly")
    public ResponseEntity<Map<String, Object>> getMonthlyReport(
            @RequestParam int year,
            @RequestParam int month) {
        Map<String, Object> report = costService.getMonthlyReport(year, month);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/monthly/export")
    public ResponseEntity<byte[]> exportMonthlyReport(
            @RequestParam int year,
            @RequestParam int month) {
        byte[] csvData = costService.exportMonthlyReport(year, month);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "cost-report-" + year + "-" + month + ".csv");

        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }
}

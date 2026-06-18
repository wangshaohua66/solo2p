package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.response.FunnelDataVO;
import com.wedding.suite.dto.response.RevenuePointVO;
import com.wedding.suite.dto.response.ScoreDataVO;
import com.wedding.suite.dto.response.SummaryVO;
import com.wedding.suite.service.impl.ReportService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/revenue")
    public ApiResponse<List<RevenuePointVO>> revenue(@RequestParam(required = false) Long storeId) {
        return ApiResponse.ok(reportService.revenue(storeId));
    }

    @GetMapping("/funnel")
    public ApiResponse<List<FunnelDataVO>> funnel() {
        return ApiResponse.ok(reportService.funnel());
    }

    @GetMapping("/satisfaction")
    public ApiResponse<List<ScoreDataVO>> satisfaction() {
        return ApiResponse.ok(reportService.satisfaction());
    }

    @GetMapping("/summary")
    public ApiResponse<SummaryVO> summary() {
        return ApiResponse.ok(reportService.summary());
    }
}

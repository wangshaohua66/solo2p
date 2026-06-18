package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.response.MonthlyStatVO;
import com.wedding.suite.dto.response.OverdueItemVO;
import com.wedding.suite.entity.FinanceEntity;
import com.wedding.suite.service.impl.FinanceService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/finance")
public class FinanceController {

    private final FinanceService financeService;

    public FinanceController(FinanceService financeService) {
        this.financeService = financeService;
    }

    @GetMapping("/wedding/{weddingId}")
    public ApiResponse<FinanceEntity> wedding(@PathVariable Long weddingId) {
        return ApiResponse.ok(financeService.wedding(weddingId));
    }

    @GetMapping("/monthly")
    public ApiResponse<List<MonthlyStatVO>> monthly(@RequestParam(required = false) Long storeId) {
        return ApiResponse.ok(financeService.monthly(storeId));
    }

    @GetMapping("/overdue")
    public ApiResponse<List<OverdueItemVO>> overdue() {
        return ApiResponse.ok(financeService.overdue());
    }
}

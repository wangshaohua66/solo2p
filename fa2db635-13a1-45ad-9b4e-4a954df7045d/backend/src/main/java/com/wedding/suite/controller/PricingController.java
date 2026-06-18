package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.PricingCalcRequest;
import com.wedding.suite.dto.response.QuoteVO;
import com.wedding.suite.service.impl.PricingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/pricing")
public class PricingController {

    private final PricingService pricingService;

    public PricingController(PricingService pricingService) {
        this.pricingService = pricingService;
    }

    @PostMapping("/calc")
    public ApiResponse<QuoteVO> calc(@Valid @RequestBody PricingCalcRequest req) {
        return ApiResponse.ok(pricingService.calc(req));
    }
}

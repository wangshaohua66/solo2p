package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.WeddingCreateRequest;
import com.wedding.suite.dto.response.WeddingVO;
import com.wedding.suite.service.impl.WeddingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/weddings")
public class WeddingController {

    private final WeddingService weddingService;

    public WeddingController(WeddingService weddingService) {
        this.weddingService = weddingService;
    }

    @GetMapping
    public ApiResponse<List<WeddingVO>> list(
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) Long storeId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(weddingService.list(stage, storeId, date, keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<WeddingVO> detail(@PathVariable Long id) {
        return ApiResponse.ok(weddingService.detail(id));
    }

    @PostMapping
    public ApiResponse<WeddingVO> create(@Valid @RequestBody WeddingCreateRequest req) {
        return ApiResponse.ok(weddingService.create(req));
    }

    @PutMapping("/{id}/stage")
    public ApiResponse<WeddingVO> updateStage(@PathVariable Long id,
                                               @RequestParam String stage) {
        return ApiResponse.ok(weddingService.updateStage(id, stage));
    }
}

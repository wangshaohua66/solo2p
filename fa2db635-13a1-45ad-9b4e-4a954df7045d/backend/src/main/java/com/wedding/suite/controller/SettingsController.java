package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.StoreSaveRequest;
import com.wedding.suite.dto.response.SettingsVO;
import com.wedding.suite.entity.StoreEntity;
import com.wedding.suite.service.impl.SettingsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ApiResponse<SettingsVO> list() {
        return ApiResponse.ok(settingsService.list());
    }

    @PostMapping("/store")
    public ApiResponse<StoreEntity> saveStore(@Valid @RequestBody StoreSaveRequest req) {
        return ApiResponse.ok(settingsService.saveStore(req));
    }
}

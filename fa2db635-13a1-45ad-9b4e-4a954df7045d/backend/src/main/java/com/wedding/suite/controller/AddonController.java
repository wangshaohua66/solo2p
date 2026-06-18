package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.entity.AddonEntity;
import com.wedding.suite.service.impl.PackageService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/addons")
public class AddonController {

    private final PackageService packageService;

    public AddonController(PackageService packageService) {
        this.packageService = packageService;
    }

    @GetMapping
    public ApiResponse<List<AddonEntity>> list() {
        return ApiResponse.ok(packageService.listAddons());
    }
}

package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.PackageSaveRequest;
import com.wedding.suite.entity.AddonEntity;
import com.wedding.suite.entity.PackageEntity;
import com.wedding.suite.service.impl.PackageService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/packages")
public class PackageController {

    private final PackageService packageService;

    public PackageController(PackageService packageService) {
        this.packageService = packageService;
    }

    @GetMapping
    public ApiResponse<List<PackageEntity>> list() {
        return ApiResponse.ok(packageService.list());
    }

    @PostMapping
    public ApiResponse<PackageEntity> save(@Valid @RequestBody PackageSaveRequest req) {
        return ApiResponse.ok(packageService.save(req));
    }
}

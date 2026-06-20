package com.tobacco.controller;

import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.Result;
import com.tobacco.dto.request.LicenseApplyRequest;
import com.tobacco.dto.request.LicenseQuery;
import com.tobacco.dto.request.LicenseReviewRequest;
import com.tobacco.entity.License;
import com.tobacco.service.LicenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "许可证管理", description = "许可证申请、审批、查询、状态流转等接口")
@RestController
@RequestMapping("/license")
@RequiredArgsConstructor
public class LicenseController {

    private final LicenseService licenseService;

    @Operation(summary = "提交许可证申请", description = "支持新办、延续、变更、停业、恢复营业、注销六种申请类型")
    @PostMapping("/apply")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_INSPECTOR')")
    public Result<License> applyLicense(@Valid @RequestBody LicenseApplyRequest request) {
        return Result.success(licenseService.applyLicense(request));
    }

    @Operation(summary = "许可证审批", description = "管理所初审、县局复审、市局终审三级审批")
    @PostMapping("/review")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<License> reviewLicense(@Valid @RequestBody LicenseReviewRequest request) {
        return Result.success(licenseService.reviewLicense(request, null, null));
    }

    @Operation(summary = "获取许可证详情", description = "根据许可证ID获取详细信息")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_RETAILER')")
    public Result<License> getLicenseById(
            @Parameter(description = "许可证ID") @PathVariable Long id) {
        return Result.success(licenseService.getLicenseById(id));
    }

    @Operation(summary = "根据许可证号查询", description = "通过许可证编号查询许可证信息")
    @GetMapping("/no/{licenseNo}")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<License> getLicenseByNo(
            @Parameter(description = "许可证编号") @PathVariable String licenseNo) {
        return Result.success(licenseService.getLicenseByNo(licenseNo));
    }

    @Operation(summary = "分页查询许可证列表", description = "支持按状态、业态、辖区等多条件分页查询")
    @GetMapping("/page")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<PageResult<License>> getLicensePage(LicenseQuery query) {
        return Result.success(licenseService.getLicensePage(query));
    }

    @Operation(summary = "查询即将到期的许可证", description = "查询未来30天内即将到期的许可证列表，用于延续提醒")
    @GetMapping("/expiring")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<List<License>> getExpiringLicenses() {
        return Result.success(licenseService.getExpiringLicenses());
    }

    @Operation(summary = "查询零售户许可证历史", description = "根据零售户ID查询所有许可证申请记录")
    @GetMapping("/retailer/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_RETAILER')")
    public Result<List<License>> getLicenseListByRetailer(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(licenseService.getLicenseListByRetailer(retailerId));
    }
}

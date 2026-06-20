package com.tobacco.controller;

import com.tobacco.common.enums.CreditLevel;
import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.Result;
import com.tobacco.entity.CreditRecord;
import com.tobacco.service.CreditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "信用评级", description = "信用分查询、信用等级、变更记录、信用系数等接口")
@RestController
@RequestMapping("/credit")
@RequiredArgsConstructor
public class CreditController {

    private final CreditService creditService;

    @Operation(summary = "查询零售户信用分", description = "根据零售户ID查询当前信用分数")
    @GetMapping("/score/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<Integer> getCreditScore(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(creditService.getCreditScore(retailerId));
    }

    @Operation(summary = "查询零售户信用等级", description = "根据零售户ID查询当前信用等级")
    @GetMapping("/level/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<CreditLevel> getCreditLevel(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(creditService.getCreditLevel(retailerId));
    }

    @Operation(summary = "查询信用系数", description = "根据零售户ID查询订货配额信用系数")
    @GetMapping("/coefficient/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN')")
    public Result<BigDecimal> getCreditCoefficient(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(creditService.getCreditCoefficient(retailerId));
    }

    @Operation(summary = "分页查询信用变更记录", description = "支持按零售户、辖区、变更类型等条件分页查询")
    @GetMapping("/records/page")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<PageResult<CreditRecord>> getCreditRecordPage(
            @Parameter(description = "零售户ID") @RequestParam(required = false) Long retailerId,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId,
            @Parameter(description = "管理所ID") @RequestParam(required = false) Long stationId,
            @Parameter(description = "变更类型：DEDUCT扣分 BONUS加分 REPAIR修复")
            @RequestParam(required = false) String changeType,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(creditService.getCreditRecordPage(
                retailerId, countyId, stationId, changeType, pageNum, pageSize));
    }

    @Operation(summary = "查询零售户信用记录列表", description = "根据零售户ID查询所有信用变更记录")
    @GetMapping("/records/retailer/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<List<CreditRecord>> getCreditRecordsByRetailer(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(creditService.getCreditRecordsByRetailer(retailerId));
    }

    @Operation(summary = "触发周期信用检查", description = "执行期末信用检查，包括连续无违规修复等逻辑")
    @PostMapping("/period-check")
    @PreAuthorize("hasAnyRole('ROLE_CITY_ADMIN', 'ROLE_COUNTY_ADMIN')")
    public Result<Void> processPeriodEndCreditCheck() {
        creditService.processPeriodEndCreditCheck();
        return Result.success();
    }
}

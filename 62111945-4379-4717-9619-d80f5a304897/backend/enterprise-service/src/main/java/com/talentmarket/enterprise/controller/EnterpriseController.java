package com.talentmarket.enterprise.controller;

import com.talentmarket.common.result.PageResult;
import com.talentmarket.common.result.Result;
import com.talentmarket.enterprise.entity.Enterprise;
import com.talentmarket.enterprise.service.EnterpriseService;
import com.talentmarket.enterprise.service.EnterpriseVerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/enterprise")
@RequiredArgsConstructor
public class EnterpriseController {

    private final EnterpriseService enterpriseService;
    private final EnterpriseVerificationService verificationService;

    @GetMapping("/{id}")
    public Result<Enterprise> getById(@PathVariable Long id) {
        return Result.success(enterpriseService.getById(id));
    }

    @GetMapping("/list")
    public Result<PageResult<Enterprise>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer authStatus,
            @RequestParam(required = false) Integer status) {
        var pageResult = enterpriseService.list(page, pageSize, keyword, authStatus, status);
        return Result.success(PageResult.of(
                pageResult.getRecords(), pageResult.getTotal(), page, pageSize));
    }

    @PostMapping("/register")
    public Result<Enterprise> register(@RequestBody Enterprise enterprise) {
        return Result.success(enterpriseService.register(enterprise));
    }

    @PostMapping("/verify/auto/{id}")
    public Result<Boolean> autoVerify(@PathVariable Long id) {
        return Result.success(enterpriseService.autoVerify(id));
    }

    @PostMapping("/verify/manual/{id}")
    public Result<Boolean> manualVerify(@PathVariable Long id,
                                         @RequestParam boolean passed,
                                         @RequestParam(required = false) String remark,
                                         @RequestHeader("X-User-Id") Long adminId) {
        return Result.success(enterpriseService.manualVerify(id, passed, remark, adminId));
    }

    @PostMapping("/validate/credit-code")
    public Result<Boolean> validateCreditCode(@RequestParam String creditCode) {
        return Result.success(verificationService.validateCreditCode(creditCode));
    }

    @PutMapping
    public Result<Boolean> update(@RequestBody Enterprise enterprise) {
        return Result.success(enterpriseService.update(enterprise));
    }

    @GetMapping("/check-verified/{id}")
    public Result<Boolean> checkVerified(@PathVariable Long id) {
        return Result.success(enterpriseService.checkEnterpriseVerified(id));
    }
}

package com.insurance.claim.controller;

import com.insurance.claim.common.ApiResponse;
import com.insurance.claim.entity.Policy;
import com.insurance.claim.service.PolicyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/policy")
@RequiredArgsConstructor
@Tag(name = "2-理赔报案")
public class PolicyController {

    private final PolicyService policyService;

    @GetMapping("/{policyNo}")
    @Operation(summary = "查询保单信息", description = "根据保单号查询保单详细信息")
    public ApiResponse<Policy> getPolicyByNo(
            @Parameter(description = "保单号") @PathVariable String policyNo) {
        Policy policy = policyService.getPolicyByNo(policyNo);
        return ApiResponse.success(policy);
    }

    @GetMapping("/validate/{policyNo}")
    @Operation(summary = "保单有效性校验", description = "校验保单是否有效、是否在保险期间内")
    public ApiResponse<Boolean> validatePolicy(
            @Parameter(description = "保单号") @PathVariable String policyNo,
            @Parameter(description = "险种代码") @RequestParam Integer insuranceType) {
        try {
            com.insurance.claim.enums.InsuranceType type = com.insurance.claim.enums.InsuranceType.fromCode(insuranceType);
            policyService.validatePolicy(policyNo, type);
            return ApiResponse.success("保单有效", true);
        } catch (Exception e) {
            return ApiResponse.success(e.getMessage(), false);
        }
    }

    @GetMapping("/insured/{idCard}")
    @Operation(summary = "查询被保险人名下保单", description = "根据身份证号查询被保险人的所有有效保单")
    public ApiResponse<List<Policy>> getPoliciesByInsuredIdCard(
            @Parameter(description = "身份证号") @PathVariable String idCard) {
        List<Policy> policies = policyService.getPoliciesByInsuredIdCard(idCard);
        return ApiResponse.success(policies);
    }

    @GetMapping("/vehicle/{plateNo}")
    @Operation(summary = "根据车牌号查询保单", description = "根据车牌号查询对应的车险保单")
    public ApiResponse<List<Policy>> getPoliciesByVehiclePlateNo(
            @Parameter(description = "车牌号") @PathVariable String plateNo) {
        List<Policy> policies = policyService.getPoliciesByVehiclePlateNo(plateNo);
        return ApiResponse.success(policies);
    }
}

package com.emergency.auth.controller;

import com.emergency.auth.entity.Organization;
import com.emergency.auth.service.OrganizationService;
import com.emergency.common.result.Result;
import com.emergency.common.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/organizations")
@RequiredArgsConstructor
@Tag(name = "组织管理", description = "三级组织架构管理接口")
public class OrganizationController {

    private final OrganizationService organizationService;

    @GetMapping("/{id}")
    @Operation(summary = "获取组织详情")
    public Result<Organization> getOrganizationById(@PathVariable Long id) {
        return Result.success(organizationService.getOrganizationById(id));
    }

    @GetMapping("/code/{code}")
    @Operation(summary = "根据编码获取组织")
    public Result<Organization> getOrganizationByCode(@PathVariable String code) {
        return Result.success(organizationService.getOrganizationByCode(code));
    }

    @GetMapping("/region/{regionCode}")
    @Operation(summary = "根据行政区划获取组织")
    public Result<Organization> getOrganizationByRegionCode(@PathVariable String regionCode) {
        return Result.success(organizationService.getOrganizationByRegionCode(regionCode));
    }

    @GetMapping("/tree")
    @Operation(summary = "获取组织树")
    public Result<List<Organization>> getOrganizationTree(@RequestParam(required = false) Long parentId) {
        if (parentId == null) {
            parentId = SecurityUtils.getCurrentOrganizationId();
        }
        return Result.success(organizationService.getOrganizationTree(parentId));
    }

    @GetMapping("/children/{parentId}")
    @Operation(summary = "获取下级组织列表")
    public Result<List<Organization>> getChildOrganizations(@PathVariable Long parentId) {
        return Result.success(organizationService.getChildOrganizations(parentId));
    }

    @GetMapping("/accessible")
    @Operation(summary = "获取当前用户可访问的组织ID列表")
    public Result<List<Long>> getAccessibleOrgIds(@RequestParam(required = false) Integer dataScope) {
        Long orgId = SecurityUtils.getCurrentOrganizationId();
        return Result.success(organizationService.getAccessibleOrgIds(orgId, dataScope));
    }
}

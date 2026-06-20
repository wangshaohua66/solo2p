package com.mw.registration.service;

import com.mw.common.enums.WasteCategory;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.common.security.UserContext;
import com.mw.common.security.UserInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 机构资质与操作员权限校验。
 * 机构资质：orgId 必须命中资质白名单（mw.qualification.org-whitelist 为空时全部放行）。
 * 操作员权限：当前登录用户必须归属同一机构，且具备产废机构角色。
 * 废物类别合规性：仅允许五类标准类别，病理性废物需具备处置资质的医院（白名单标记）。
 */
@Slf4j
@Service
public class QualificationService {

    @Value("${mw.qualification.org-whitelist:}")
    private String orgWhitelist;

    @Value("${mw.qualification.pathological-org-whitelist:}")
    private String pathologicalOrgWhitelist;

    public void check(String orgId, WasteCategory category) {
        UserInfo user = UserContext.get();
        if (user == null || user.getOrgId() == null) {
            throw new BusinessException(ResultCode.OPERATOR_NO_PERMISSION, "无法识别操作员归属机构");
        }
        if (!user.getOrgId().equals(orgId)) {
            throw new BusinessException(ResultCode.OPERATOR_NO_PERMISSION, "操作员无权为该机构登记废物");
        }
        if (user.getRoles() == null || !user.getRoles().contains("ROLE_PRODUCER")) {
            throw new BusinessException(ResultCode.OPERATOR_NO_PERMISSION, "当前角色无废物登记权限");
        }
        if (!orgQualified(orgId)) {
            throw new BusinessException(ResultCode.ORG_NOT_QUALIFIED, "机构资质校验失败: " + orgId);
        }
        if (category == WasteCategory.PATHOLOGICAL && !pathologicalQualified(orgId)) {
            throw new BusinessException(ResultCode.ORG_NOT_QUALIFIED, "该机构无病理性废物处置资质");
        }
    }

    private boolean orgQualified(String orgId) {
        Set<String> whitelist = parse(orgWhitelist);
        return whitelist.isEmpty() || whitelist.contains(orgId);
    }

    private boolean pathologicalQualified(String orgId) {
        Set<String> whitelist = parse(pathologicalOrgWhitelist);
        return whitelist.isEmpty() || whitelist.contains(orgId);
    }

    private Set<String> parse(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }
}

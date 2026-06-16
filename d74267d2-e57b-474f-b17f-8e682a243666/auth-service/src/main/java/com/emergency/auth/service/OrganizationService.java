package com.emergency.auth.service;

import com.emergency.auth.entity.Organization;

import java.util.List;

public interface OrganizationService {

    Organization getOrganizationById(Long id);

    Organization getOrganizationByCode(String code);

    Organization getOrganizationByRegionCode(String regionCode);

    List<Organization> getOrganizationTree(Long parentId);

    List<Organization> getChildOrganizations(Long parentId);

    List<Long> getChildOrgIds(Long orgId);

    List<Long> getAccessibleOrgIds(Long orgId, Integer dataScope);

    boolean isInSameRegion(Long orgId1, Long orgId2);

    Integer getOrgLevel(Long orgId);
}

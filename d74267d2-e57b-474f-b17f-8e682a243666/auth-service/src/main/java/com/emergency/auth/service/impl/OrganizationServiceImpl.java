package com.emergency.auth.service.impl;

import com.emergency.auth.entity.Organization;
import com.emergency.auth.mapper.OrganizationMapper;
import com.emergency.auth.service.OrganizationService;
import com.emergency.common.enums.OrganizationLevel;
import com.emergency.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrganizationServiceImpl implements OrganizationService {

    private final OrganizationMapper organizationMapper;

    @Override
    public Organization getOrganizationById(Long id) {
        return organizationMapper.selectById(id);
    }

    @Override
    public Organization getOrganizationByCode(String code) {
        return organizationMapper.selectByCode(code);
    }

    @Override
    public Organization getOrganizationByRegionCode(String regionCode) {
        return organizationMapper.selectByRegionCode(regionCode);
    }

    @Override
    public List<Organization> getOrganizationTree(Long parentId) {
        List<Organization> orgs = organizationMapper.selectByParentId(parentId);
        for (Organization org : orgs) {
            org.setChildren(getOrganizationTree(org.getId()));
        }
        return orgs;
    }

    @Override
    public List<Organization> getChildOrganizations(Long parentId) {
        return organizationMapper.selectByParentId(parentId);
    }

    @Override
    public List<Long> getChildOrgIds(Long orgId) {
        Organization org = organizationMapper.selectById(orgId);
        if (org == null) {
            throw new BusinessException("组织不存在");
        }
        List<Long> ids = organizationMapper.selectChildIds(org.getParentPath() + org.getId() + "/");
        ids.add(orgId);
        return ids;
    }

    @Override
    public List<Long> getAccessibleOrgIds(Long orgId, Integer dataScope) {
        List<Long> ids = new ArrayList<>();
        if (dataScope == null) {
            dataScope = 1;
        }
        switch (dataScope) {
            case 0:
                List<Organization> allOrgs = organizationMapper.selectByParentPath("/1/");
                for (Organization org : allOrgs) {
                    ids.add(org.getId());
                }
                break;
            case 1:
                ids = getChildOrgIds(orgId);
                break;
            case 2:
                ids.add(orgId);
                break;
            default:
                ids.add(orgId);
        }
        return ids;
    }

    @Override
    public boolean isInSameRegion(Long orgId1, Long orgId2) {
        Organization org1 = organizationMapper.selectById(orgId1);
        Organization org2 = organizationMapper.selectById(orgId2);
        if (org1 == null || org2 == null) {
            return false;
        }
        String region1 = org1.getRegionCode().substring(0, 2);
        String region2 = org2.getRegionCode().substring(0, 2);
        return region1.equals(region2);
    }

    @Override
    public Integer getOrgLevel(Long orgId) {
        Organization org = organizationMapper.selectById(orgId);
        return org != null ? org.getLevel().getCode() : OrganizationLevel.COUNTY.getCode();
    }
}

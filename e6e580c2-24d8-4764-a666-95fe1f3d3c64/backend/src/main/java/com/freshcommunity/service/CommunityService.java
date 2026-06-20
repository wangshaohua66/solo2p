package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.Community;
import com.freshcommunity.mapper.CommunityMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class CommunityService extends ServiceImpl<CommunityMapper, Community> {

    public Page<Community> getCommunityPage(int pageNum, int pageSize, String name, Integer status) {
        Page<Community> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Community> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(name)) {
            wrapper.like(Community::getName, name);
        }
        if (status != null) {
            wrapper.eq(Community::getStatus, status);
        }
        wrapper.orderByDesc(Community::getCreateTime);
        return page(page, wrapper);
    }

    public boolean addCommunity(Community community) {
        return save(community);
    }

    public boolean updateCommunity(Community community) {
        return updateById(community);
    }

    public boolean deleteCommunity(Long id) {
        return removeById(id);
    }

    public Community getCommunityDetail(Long id) {
        return getById(id);
    }
}

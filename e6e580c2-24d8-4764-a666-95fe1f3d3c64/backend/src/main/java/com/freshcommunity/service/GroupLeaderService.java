package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.GroupLeader;
import com.freshcommunity.mapper.GroupLeaderMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;

@Service
public class GroupLeaderService extends ServiceImpl<GroupLeaderMapper, GroupLeader> {

    public Page<GroupLeader> getLeaderPage(int pageNum, int pageSize, String name, String phone, Integer status) {
        Page<GroupLeader> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<GroupLeader> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(name)) {
            wrapper.like(GroupLeader::getName, name);
        }
        if (StringUtils.hasText(phone)) {
            wrapper.like(GroupLeader::getPhone, phone);
        }
        if (status != null) {
            wrapper.eq(GroupLeader::getStatus, status);
        }
        wrapper.orderByDesc(GroupLeader::getCreateTime);
        return page(page, wrapper);
    }

    public boolean addLeader(GroupLeader leader) {
        if (leader.getCommissionRate() == null) {
            leader.setCommissionRate(new BigDecimal("5.00"));
        }
        if (leader.getTotalCommission() == null) {
            leader.setTotalCommission(BigDecimal.ZERO);
        }
        if (leader.getAvailableCommission() == null) {
            leader.setAvailableCommission(BigDecimal.ZERO);
        }
        return save(leader);
    }

    public boolean updateLeader(GroupLeader leader) {
        return updateById(leader);
    }

    public boolean deleteLeader(Long id) {
        return removeById(id);
    }

    public GroupLeader getLeaderDetail(Long id) {
        return getById(id);
    }

    public GroupLeader getLeaderByCommunityId(Long communityId) {
        return getOne(new LambdaQueryWrapper<GroupLeader>()
                .eq(GroupLeader::getCommunityId, communityId));
    }
}

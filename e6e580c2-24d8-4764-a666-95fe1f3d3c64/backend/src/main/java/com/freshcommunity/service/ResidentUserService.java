package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.ResidentUser;
import com.freshcommunity.mapper.ResidentUserMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;

@Service
public class ResidentUserService extends ServiceImpl<ResidentUserMapper, ResidentUser> {

    public Page<ResidentUser> getUserPage(int pageNum, int pageSize, String username, String phone,
                                          Long communityId, Integer level, Integer status) {
        Page<ResidentUser> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ResidentUser> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(username)) {
            wrapper.like(ResidentUser::getUsername, username);
        }
        if (StringUtils.hasText(phone)) {
            wrapper.like(ResidentUser::getPhone, phone);
        }
        if (communityId != null) {
            wrapper.eq(ResidentUser::getCommunityId, communityId);
        }
        if (level != null) {
            wrapper.eq(ResidentUser::getLevel, level);
        }
        if (status != null) {
            wrapper.eq(ResidentUser::getStatus, status);
        }
        wrapper.orderByDesc(ResidentUser::getCreateTime);
        return page(page, wrapper);
    }

    public boolean addUser(ResidentUser user) {
        if (user.getLevel() == null) {
            user.setLevel(1);
        }
        if (user.getPoints() == null) {
            user.setPoints(0);
        }
        if (user.getTotalAmount() == null) {
            user.setTotalAmount(BigDecimal.ZERO);
        }
        if (user.getOrderCount() == null) {
            user.setOrderCount(0);
        }
        if (user.getStatus() == null) {
            user.setStatus(1);
        }
        return save(user);
    }

    public ResidentUser getUserByPhone(String phone) {
        return getOne(new LambdaQueryWrapper<ResidentUser>().eq(ResidentUser::getPhone, phone));
    }

    public boolean updateUserLevel(Long userId, Integer level, Integer points) {
        ResidentUser user = getById(userId);
        if (user == null) {
            return false;
        }
        user.setLevel(level);
        user.setPoints(points);
        return updateById(user);
    }

    public boolean updateUserAmount(Long userId, BigDecimal amount, int orderCount) {
        ResidentUser user = getById(userId);
        if (user == null) {
            return false;
        }
        BigDecimal totalAmount = user.getTotalAmount() == null ? BigDecimal.ZERO : user.getTotalAmount();
        user.setTotalAmount(totalAmount.add(amount));
        int totalOrders = user.getOrderCount() == null ? 0 : user.getOrderCount();
        user.setOrderCount(totalOrders + orderCount);
        int newPoints = (user.getPoints() == null ? 0 : user.getPoints()) + amount.intValue();
        user.setPoints(newPoints);
        if (newPoints >= 5000) {
            user.setLevel(5);
        } else if (newPoints >= 3000) {
            user.setLevel(4);
        } else if (newPoints >= 1500) {
            user.setLevel(3);
        } else if (newPoints >= 500) {
            user.setLevel(2);
        }
        return updateById(user);
    }
}

package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.Supplier;
import com.freshcommunity.mapper.SupplierMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SupplierService extends ServiceImpl<SupplierMapper, Supplier> {

    public Page<Supplier> getSupplierPage(int pageNum, int pageSize, String name, String contactPerson, Integer status) {
        Page<Supplier> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Supplier> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(name)) {
            wrapper.like(Supplier::getName, name);
        }
        if (StringUtils.hasText(contactPerson)) {
            wrapper.like(Supplier::getContactPerson, contactPerson);
        }
        if (status != null) {
            wrapper.eq(Supplier::getStatus, status);
        }
        wrapper.orderByDesc(Supplier::getCreateTime);
        return page(page, wrapper);
    }

    public boolean addSupplier(Supplier supplier) {
        if (supplier.getSettlementCycle() == null) {
            supplier.setSettlementCycle(7);
        }
        if (supplier.getTotalSettlement() == null) {
            supplier.setTotalSettlement(java.math.BigDecimal.ZERO);
        }
        return save(supplier);
    }

    public boolean updateSupplier(Supplier supplier) {
        return updateById(supplier);
    }

    public boolean deleteSupplier(Long id) {
        return removeById(id);
    }

    public Supplier getSupplierDetail(Long id) {
        return getById(id);
    }
}

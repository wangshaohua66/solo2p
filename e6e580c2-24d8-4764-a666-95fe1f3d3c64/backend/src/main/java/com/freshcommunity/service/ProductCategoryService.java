package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.ProductCategory;
import com.freshcommunity.mapper.ProductCategoryMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductCategoryService extends ServiceImpl<ProductCategoryMapper, ProductCategory> {

    public List<ProductCategory> getCategoryTree() {
        List<ProductCategory> allCategories = list(new LambdaQueryWrapper<ProductCategory>()
                .orderByAsc(ProductCategory::getSortOrder));
        List<ProductCategory> rootCategories = allCategories.stream()
                .filter(c -> c.getParentId() == null || c.getParentId() == 0)
                .collect(Collectors.toList());
        buildTree(rootCategories, allCategories);
        return rootCategories;
    }

    private void buildTree(List<ProductCategory> parents, List<ProductCategory> all) {
        for (ProductCategory parent : parents) {
            List<ProductCategory> children = all.stream()
                    .filter(c -> parent.getId().equals(c.getParentId()))
                    .collect(Collectors.toList());
            if (!children.isEmpty()) {
                buildTree(children, all);
            }
        }
    }

    public List<ProductCategory> getCategoriesByParentId(Long parentId) {
        return list(new LambdaQueryWrapper<ProductCategory>()
                .eq(ProductCategory::getParentId, parentId == null ? 0 : parentId)
                .orderByAsc(ProductCategory::getSortOrder));
    }

    public boolean addCategory(ProductCategory category) {
        if (category.getParentId() == null) {
            category.setParentId(0L);
        }
        if (category.getSortOrder() == null) {
            category.setSortOrder(0);
        }
        if (category.getStatus() == null) {
            category.setStatus(1);
        }
        return save(category);
    }
}

package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.Product;
import com.freshcommunity.entity.ProductCommunityStock;
import com.freshcommunity.mapper.ProductMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;

@Service
public class ProductService extends ServiceImpl<ProductMapper, Product> {

    @Autowired
    private ProductCommunityStockService stockService;

    public Page<Product> getProductPage(int pageNum, int pageSize, String name, Long categoryId,
                                       Long supplierId, Integer status, Integer auditStatus) {
        Page<Product> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(name)) {
            wrapper.like(Product::getName, name);
        }
        if (categoryId != null) {
            wrapper.eq(Product::getCategoryId, categoryId);
        }
        if (supplierId != null) {
            wrapper.eq(Product::getSupplierId, supplierId);
        }
        if (status != null) {
            wrapper.eq(Product::getStatus, status);
        }
        if (auditStatus != null) {
            wrapper.eq(Product::getAuditStatus, auditStatus);
        }
        wrapper.orderByAsc(Product::getSortOrder).orderByDesc(Product::getCreateTime);
        return page(page, wrapper);
    }

    public boolean addProduct(Product product) {
        if (product.getStatus() == null) {
            product.setStatus(0);
        }
        if (product.getAuditStatus() == null) {
            product.setAuditStatus(0);
        }
        if (product.getSoldCount() == null) {
            product.setSoldCount(0);
        }
        boolean success = save(product);
        return success;
    }

    public boolean batchAddProducts(List<Product> products) {
        for (Product product : products) {
            if (product.getStatus() == null) {
                product.setStatus(0);
            }
            if (product.getAuditStatus() == null) {
                product.setAuditStatus(0);
            }
            if (product.getSoldCount() == null) {
                product.setSoldCount(0);
            }
        }
        return saveBatch(products);
    }

    public boolean auditProduct(Long id, Integer auditStatus, String auditRemark) {
        Product product = getById(id);
        if (product == null) {
            return false;
        }
        product.setAuditStatus(auditStatus);
        product.setAuditRemark(auditRemark);
        if (auditStatus == 2) {
            product.setStatus(1);
        }
        return updateById(product);
    }

    public boolean updateProductStatus(Long id, Integer status) {
        Product product = getById(id);
        if (product == null) {
            return false;
        }
        product.setStatus(status);
        return updateById(product);
    }

    public List<Product> getProductsBySupplier(Long supplierId) {
        return list(new LambdaQueryWrapper<Product>().eq(Product::getSupplierId, supplierId));
    }

    public List<Product> getProductsByCategory(Long categoryId) {
        return list(new LambdaQueryWrapper<Product>().eq(Product::getCategoryId, categoryId));
    }

    public boolean increaseSoldCount(Long productId, Integer quantity) {
        Product product = getById(productId);
        if (product != null) {
            product.setSoldCount((product.getSoldCount() == null ? 0 : product.getSoldCount()) + quantity);
            if (product.getTotalStock() != null && product.getSoldCount() >= product.getTotalStock()) {
                product.setStatus(2);
            }
            return updateById(product);
        }
        return false;
    }

    public List<Product> getTopSellingProducts(int limit) {
        Page<Product> page = new Page<>(1, limit);
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(Product::getSoldCount);
        return page(page, wrapper).getRecords();
    }
}

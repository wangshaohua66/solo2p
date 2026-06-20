package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.ProductCommunityStock;
import com.freshcommunity.mapper.ProductCommunityStockMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class ProductCommunityStockService extends ServiceImpl<ProductCommunityStockMapper, ProductCommunityStock> {

    public List<ProductCommunityStock> getStockByProduct(Long productId) {
        return list(new LambdaQueryWrapper<ProductCommunityStock>()
                .eq(ProductCommunityStock::getProductId, productId));
    }

    public ProductCommunityStock getStock(Long productId, Long communityId) {
        return getOne(new LambdaQueryWrapper<ProductCommunityStock>()
                .eq(ProductCommunityStock::getProductId, productId)
                .eq(ProductCommunityStock::getCommunityId, communityId));
    }

    public boolean allocateStock(Long productId, Long communityId, Integer stock, BigDecimal price) {
        ProductCommunityStock existing = getStock(productId, communityId);
        if (existing != null) {
            existing.setStock(stock);
            if (price != null) {
                existing.setPrice(price);
            }
            return updateById(existing);
        } else {
            ProductCommunityStock newStock = new ProductCommunityStock();
            newStock.setProductId(productId);
            newStock.setCommunityId(communityId);
            newStock.setStock(stock);
            newStock.setLockedStock(0);
            newStock.setSoldCount(0);
            newStock.setPrice(price != null ? price : BigDecimal.ZERO);
            return save(newStock);
        }
    }

    public boolean batchAllocateStock(List<ProductCommunityStock> stockList) {
        for (ProductCommunityStock stock : stockList) {
            ProductCommunityStock existing = getStock(stock.getProductId(), stock.getCommunityId());
            if (existing != null) {
                existing.setStock(stock.getStock());
                if (stock.getPrice() != null) {
                    existing.setPrice(stock.getPrice());
                }
                updateById(existing);
            } else {
                stock.setLockedStock(0);
                stock.setSoldCount(0);
                save(stock);
            }
        }
        return true;
    }

    public boolean lockStock(Long productId, Long communityId, Integer quantity) {
        ProductCommunityStock stock = getStock(productId, communityId);
        if (stock == null || stock.getStock() < quantity) {
            return false;
        }
        stock.setStock(stock.getStock() - quantity);
        stock.setLockedStock(stock.getLockedStock() + quantity);
        return updateById(stock);
    }

    public boolean deductStock(Long productId, Long communityId, Integer quantity) {
        ProductCommunityStock stock = getStock(productId, communityId);
        if (stock == null) {
            return false;
        }
        stock.setLockedStock(Math.max(0, stock.getLockedStock() - quantity));
        stock.setSoldCount(stock.getSoldCount() + quantity);
        return updateById(stock);
    }

    public boolean releaseStock(Long productId, Long communityId, Integer quantity) {
        ProductCommunityStock stock = getStock(productId, communityId);
        if (stock == null) {
            return false;
        }
        stock.setLockedStock(Math.max(0, stock.getLockedStock() - quantity));
        stock.setStock(stock.getStock() + quantity);
        return updateById(stock);
    }

    public List<ProductCommunityStock> recommendStockAllocation(Long productId) {
        List<ProductCommunityStock> currentStocks = getStockByProduct(productId);
        int totalSold = currentStocks.stream()
                .mapToInt(s -> s.getSoldCount() == null ? 0 : s.getSoldCount())
                .sum();
        if (totalSold == 0) {
            return currentStocks;
        }
        for (ProductCommunityStock stock : currentStocks) {
            int sold = stock.getSoldCount() == null ? 0 : stock.getSoldCount();
            double ratio = (double) sold / totalSold;
            int recommendedStock = (int) Math.round(ratio * (stock.getStock() + stock.getSoldCount()) * 1.2);
            stock.setLockedStock(recommendedStock);
        }
        return currentStocks;
    }
}

package com.freshcommunity.controller;

import com.freshcommunity.common.Result;
import com.freshcommunity.entity.ProductCommunityStock;
import com.freshcommunity.service.ProductCommunityStockService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stock")
public class ProductCommunityStockController {

    @Autowired
    private ProductCommunityStockService stockService;

    @GetMapping("/product/{productId}")
    public Result<List<ProductCommunityStock>> getStockByProduct(@PathVariable Long productId) {
        List<ProductCommunityStock> list = stockService.getStockByProduct(productId);
        return Result.success(list);
    }

    @GetMapping("/detail")
    public Result<ProductCommunityStock> getStock(@RequestParam Long productId, @RequestParam Long communityId) {
        ProductCommunityStock stock = stockService.getStock(productId, communityId);
        return Result.success(stock);
    }

    @PostMapping("/allocate")
    public Result<Void> allocateStock(@RequestBody Map<String, Object> params) {
        Long productId = Long.valueOf(params.get("productId").toString());
        Long communityId = Long.valueOf(params.get("communityId").toString());
        Integer stock = Integer.valueOf(params.get("stock").toString());
        BigDecimal price = params.get("price") != null ? new BigDecimal(params.get("price").toString()) : null;
        boolean success = stockService.allocateStock(productId, communityId, stock, price);
        return success ? Result.success() : Result.error("库存分配失败");
    }

    @PostMapping("/batch-allocate")
    public Result<Void> batchAllocateStock(@RequestBody List<ProductCommunityStock> stockList) {
        boolean success = stockService.batchAllocateStock(stockList);
        return success ? Result.success() : Result.error("批量分配失败");
    }

    @GetMapping("/recommend/{productId}")
    public Result<List<ProductCommunityStock>> recommendStockAllocation(@PathVariable Long productId) {
        List<ProductCommunityStock> list = stockService.recommendStockAllocation(productId);
        return Result.success(list);
    }
}

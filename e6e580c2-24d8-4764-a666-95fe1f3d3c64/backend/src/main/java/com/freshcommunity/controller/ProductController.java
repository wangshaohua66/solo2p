package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.Product;
import com.freshcommunity.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/product")
public class ProductController {

    @Autowired
    private ProductService productService;

    @GetMapping("/page")
    public Result<PageResult<Product>> getProductPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Integer auditStatus) {
        Page<Product> page = productService.getProductPage(pageNum, pageSize, name, categoryId, supplierId, status, auditStatus);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/{id}")
    public Result<Product> getProductDetail(@PathVariable Long id) {
        Product product = productService.getById(id);
        return Result.success(product);
    }

    @GetMapping("/top-selling")
    public Result<List<Product>> getTopSellingProducts(@RequestParam(defaultValue = "50") int limit) {
        List<Product> list = productService.getTopSellingProducts(limit);
        return Result.success(list);
    }

    @GetMapping("/supplier/{supplierId}")
    public Result<List<Product>> getProductsBySupplier(@PathVariable Long supplierId) {
        List<Product> list = productService.getProductsBySupplier(supplierId);
        return Result.success(list);
    }

    @PostMapping
    public Result<Void> addProduct(@RequestBody Product product) {
        boolean success = productService.addProduct(product);
        return success ? Result.success() : Result.error("添加失败");
    }

    @PostMapping("/batch")
    public Result<Void> batchAddProducts(@RequestBody List<Product> products) {
        boolean success = productService.batchAddProducts(products);
        return success ? Result.success() : Result.error("批量添加失败");
    }

    @PutMapping
    public Result<Void> updateProduct(@RequestBody Product product) {
        boolean success = productService.updateById(product);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteProduct(@PathVariable Long id) {
        boolean success = productService.removeById(id);
        return success ? Result.success() : Result.error("删除失败");
    }

    @PutMapping("/{id}/audit")
    public Result<Void> auditProduct(@PathVariable Long id, @RequestBody Map<String, Object> params) {
        Integer auditStatus = (Integer) params.get("auditStatus");
        String auditRemark = (String) params.get("auditRemark");
        boolean success = productService.auditProduct(id, auditStatus, auditRemark);
        return success ? Result.success() : Result.error("审核失败");
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateProductStatus(@PathVariable Long id, @RequestBody Map<String, Integer> params) {
        Integer status = params.get("status");
        boolean success = productService.updateProductStatus(id, status);
        return success ? Result.success() : Result.error("状态更新失败");
    }
}

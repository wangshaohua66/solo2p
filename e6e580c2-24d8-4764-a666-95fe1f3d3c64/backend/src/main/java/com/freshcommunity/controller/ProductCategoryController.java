package com.freshcommunity.controller;

import com.freshcommunity.common.Result;
import com.freshcommunity.entity.ProductCategory;
import com.freshcommunity.service.ProductCategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/category")
public class ProductCategoryController {

    @Autowired
    private ProductCategoryService productCategoryService;

    @GetMapping("/tree")
    public Result<List<ProductCategory>> getCategoryTree() {
        List<ProductCategory> tree = productCategoryService.getCategoryTree();
        return Result.success(tree);
    }

    @GetMapping("/children/{parentId}")
    public Result<List<ProductCategory>> getChildren(@PathVariable Long parentId) {
        List<ProductCategory> list = productCategoryService.getCategoriesByParentId(parentId);
        return Result.success(list);
    }

    @GetMapping("/list")
    public Result<List<ProductCategory>> getCategoryList() {
        List<ProductCategory> list = productCategoryService.list();
        return Result.success(list);
    }

    @PostMapping
    public Result<Void> addCategory(@RequestBody ProductCategory category) {
        boolean success = productCategoryService.addCategory(category);
        return success ? Result.success() : Result.error("添加失败");
    }

    @PutMapping
    public Result<Void> updateCategory(@RequestBody ProductCategory category) {
        boolean success = productCategoryService.updateById(category);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteCategory(@PathVariable Long id) {
        boolean success = productCategoryService.removeById(id);
        return success ? Result.success() : Result.error("删除失败");
    }
}

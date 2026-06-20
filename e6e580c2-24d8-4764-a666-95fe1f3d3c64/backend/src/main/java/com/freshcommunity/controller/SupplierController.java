package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.Supplier;
import com.freshcommunity.service.SupplierService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/supplier")
public class SupplierController {

    @Autowired
    private SupplierService supplierService;

    @GetMapping("/page")
    public Result<PageResult<Supplier>> getSupplierPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String contactPerson,
            @RequestParam(required = false) Integer status) {
        Page<Supplier> page = supplierService.getSupplierPage(pageNum, pageSize, name, contactPerson, status);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/list")
    public Result<List<Supplier>> getSupplierList() {
        List<Supplier> list = supplierService.list();
        return Result.success(list);
    }

    @GetMapping("/{id}")
    public Result<Supplier> getSupplierDetail(@PathVariable Long id) {
        Supplier supplier = supplierService.getSupplierDetail(id);
        return Result.success(supplier);
    }

    @PostMapping
    public Result<Void> addSupplier(@RequestBody Supplier supplier) {
        boolean success = supplierService.addSupplier(supplier);
        return success ? Result.success() : Result.error("添加失败");
    }

    @PostMapping("/batch")
    public Result<Void> batchAddSupplier(@RequestBody List<Supplier> suppliers) {
        boolean success = supplierService.saveBatch(suppliers);
        return success ? Result.success() : Result.error("批量添加失败");
    }

    @PutMapping
    public Result<Void> updateSupplier(@RequestBody Supplier supplier) {
        boolean success = supplierService.updateSupplier(supplier);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteSupplier(@PathVariable Long id) {
        boolean success = supplierService.deleteSupplier(id);
        return success ? Result.success() : Result.error("删除失败");
    }
}

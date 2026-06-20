package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.Settlement;
import com.freshcommunity.entity.SettlementItem;
import com.freshcommunity.service.SettlementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/settlement")
public class SettlementController {

    @Autowired
    private SettlementService settlementService;

    @GetMapping("/page")
    public Result<PageResult<Settlement>> getSettlementPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String settlementNo,
            @RequestParam(required = false) Integer type,
            @RequestParam(required = false) Long targetId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        Page<Settlement> page = settlementService.getSettlementPage(pageNum, pageSize, settlementNo, type, targetId, status, startDate, endDate);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/statistics")
    public Result<Map<String, Object>> getSettlementStatistics() {
        Map<String, Object> stats = settlementService.getSettlementStatistics();
        return Result.success(stats);
    }

    @GetMapping("/{id}")
    public Result<Settlement> getSettlementDetail(@PathVariable Long id) {
        Settlement settlement = settlementService.getById(id);
        return Result.success(settlement);
    }

    @GetMapping("/{id}/items")
    public Result<List<SettlementItem>> getSettlementItems(@PathVariable Long id) {
        List<SettlementItem> items = settlementService.getSettlementItems(id);
        return Result.success(items);
    }

    @PostMapping("/supplier")
    public Result<Settlement> generateSupplierSettlement(@RequestBody Map<String, Object> params) {
        Long supplierId = Long.valueOf(params.get("supplierId").toString());
        LocalDate startDate = LocalDate.parse(params.get("startDate").toString());
        LocalDate endDate = LocalDate.parse(params.get("endDate").toString());
        Settlement settlement = settlementService.generateSupplierSettlement(supplierId, startDate, endDate);
        return Result.success("供应商对账单生成成功", settlement);
    }

    @PostMapping("/leader")
    public Result<Settlement> generateLeaderSettlement(@RequestBody Map<String, Object> params) {
        Long leaderId = Long.valueOf(params.get("leaderId").toString());
        LocalDate startDate = LocalDate.parse(params.get("startDate").toString());
        LocalDate endDate = LocalDate.parse(params.get("endDate").toString());
        Settlement settlement = settlementService.generateLeaderSettlement(leaderId, startDate, endDate);
        return Result.success("团长佣金结算单生成成功", settlement);
    }

    @PutMapping("/{id}/execute")
    public Result<Void> executeSettlement(@PathVariable Long id) {
        boolean success = settlementService.executeSettlement(id);
        return success ? Result.success("结算执行成功") : Result.error("结算执行失败");
    }

    @PutMapping("/{id}/adjust")
    public Result<Void> adjustSettlementAmount(@PathVariable Long id, @RequestParam BigDecimal newAmount, @RequestParam String remark) {
        boolean success = settlementService.adjustSettlementAmount(id, newAmount, remark);
        return success ? Result.success("调整成功") : Result.error("调整失败");
    }
}

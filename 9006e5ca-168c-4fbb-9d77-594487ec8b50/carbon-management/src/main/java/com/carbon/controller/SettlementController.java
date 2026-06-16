package com.carbon.controller;

import com.carbon.common.response.PageResult;
import com.carbon.common.response.R;
import com.carbon.dto.settlement.*;
import com.carbon.service.SettlementService;
import com.carbon.vo.settlement.SettlementVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settlement")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    @PostMapping("/clear")
    public R<SettlementVO> clear(@Valid @RequestBody SettlementClearDTO dto) {
        return R.ok(settlementService.clear(dto));
    }

    @PostMapping("/installment")
    public R<SettlementVO> applyInstallment(@Valid @RequestBody SettlementInstallmentDTO dto) {
        return R.ok(settlementService.applyInstallment(dto));
    }

    @GetMapping("/{id}")
    public R<SettlementVO> getById(@PathVariable Long id) {
        return R.ok(settlementService.getById(id));
    }

    @GetMapping("/page")
    public R<PageResult<SettlementVO>> page(SettlementQueryDTO dto) {
        return R.ok(settlementService.page(dto));
    }
}

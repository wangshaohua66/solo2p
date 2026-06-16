package com.carbon.controller;

import com.carbon.common.response.PageResult;
import com.carbon.common.response.R;
import com.carbon.dto.quota.*;
import com.carbon.service.QuotaService;
import com.carbon.vo.quota.QuotaVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/quota")
@RequiredArgsConstructor
public class QuotaController {

    private final QuotaService quotaService;

    @PostMapping("/allocate")
    public R<QuotaVO> allocate(@Valid @RequestBody QuotaAllocateDTO dto) {
        return R.ok(quotaService.allocate(dto));
    }

    @PostMapping("/issue")
    public R<QuotaVO> issue(@Valid @RequestBody QuotaIssueDTO dto) {
        return R.ok(quotaService.issue(dto));
    }

    @PostMapping("/adjust")
    public R<QuotaVO> adjust(@Valid @RequestBody QuotaAdjustDTO dto) {
        return R.ok(quotaService.adjust(dto));
    }

    @GetMapping("/{id}")
    public R<QuotaVO> getById(@PathVariable Long id) {
        return R.ok(quotaService.getById(id));
    }

    @GetMapping("/page")
    public R<PageResult<QuotaVO>> page(QuotaQueryDTO dto) {
        return R.ok(quotaService.page(dto));
    }
}

package com.carbon.controller;

import com.carbon.common.response.PageResult;
import com.carbon.common.response.R;
import com.carbon.dto.emission.*;
import com.carbon.service.EmissionService;
import com.carbon.vo.emission.EmissionReportVO;
import com.carbon.vo.emission.EmissionWarningVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/emission")
@RequiredArgsConstructor
public class EmissionController {

    private final EmissionService emissionService;

    @PostMapping("/report")
    public R<EmissionReportVO> report(@Valid @RequestBody EmissionReportDTO dto) {
        return R.ok(emissionService.report(dto));
    }

    @PostMapping("/batch-import")
    public R<List<EmissionReportVO>> batchImport(@Valid @RequestBody List<EmissionReportDTO> dtoList) {
        return R.ok(emissionService.batchImport(dtoList));
    }

    @PostMapping("/verify")
    public R<EmissionReportVO> verify(@Valid @RequestBody EmissionVerifyDTO dto) {
        return R.ok(emissionService.verify(dto));
    }

    @GetMapping("/{id}")
    public R<EmissionReportVO> getById(@PathVariable Long id) {
        return R.ok(emissionService.getById(id));
    }

    @GetMapping("/page")
    public R<PageResult<EmissionReportVO>> page(EmissionQueryDTO dto) {
        return R.ok(emissionService.page(dto));
    }

    @GetMapping("/warning/{enterpriseId}/{year}")
    public R<EmissionWarningVO> checkWarning(@PathVariable Long enterpriseId, @PathVariable Integer year) {
        return R.ok(emissionService.checkWarning(enterpriseId, year));
    }
}

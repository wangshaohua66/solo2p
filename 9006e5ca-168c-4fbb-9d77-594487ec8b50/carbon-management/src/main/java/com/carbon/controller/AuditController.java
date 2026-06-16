package com.carbon.controller;

import com.carbon.common.response.PageResult;
import com.carbon.common.response.R;
import com.carbon.dto.audit.AuditQueryDTO;
import com.carbon.service.AuditService;
import com.carbon.vo.audit.AuditLogVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/{id}")
    public R<AuditLogVO> getById(@PathVariable Long id) {
        return R.ok(auditService.getById(id));
    }

    @GetMapping("/page")
    public R<PageResult<AuditLogVO>> page(AuditQueryDTO dto) {
        return R.ok(auditService.page(dto));
    }
}

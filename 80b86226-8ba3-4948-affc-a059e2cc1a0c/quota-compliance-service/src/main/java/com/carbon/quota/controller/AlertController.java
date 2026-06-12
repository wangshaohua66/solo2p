package com.carbon.quota.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.quota.entity.CcerTransfer;
import com.carbon.quota.entity.QuotaAlert;
import com.carbon.quota.service.QuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
@Tag(name = "配额预警", description = "三级缺口预警查询、确认处理")
public class AlertController {

    private final QuotaService service;

    @GetMapping
    @Operation(summary = "分页查询预警(按级别/状态筛选)")
    public R<PageResult<QuotaAlert>> list(
            @Parameter(description = "OPEN/NOTIFIED/ACKNOWLEDGED/CLOSED")
            @RequestParam(required = false) String status,
            @ParameterObject PageQuery pq) {
        return R.ok(service.listAlerts(status, pq));
    }

    @PostMapping("/{alertId}/acknowledge")
    @Operation(summary = "确认预警(标记已处理)")
    public R<QuotaAlert> acknowledge(@PathVariable String alertId,
                                     @RequestBody(required = false) Map<String, String> body) {
        String note = body != null ? body.get("note") : null;
        return R.ok(service.acknowledgeAlert(alertId, note));
    }
}

@RestController
@RequestMapping("/quota-ledgers")
@RequiredArgsConstructor
@Tag(name = "CCER抵消", description = "CCER 签发量转入履约抵消(限额=5%)")
class CcerOffsetController {

    private final QuotaService service;

    @PostMapping("/ccer-transfers")
    @Operation(summary = "将 CCER 签发量转入对应年度履约抵消",
            description = "校验抵消量不超过年度最终配额的5%；超限返回 QUOTA_OFFSET_EXCEED")
    public R<CcerTransfer> applyOffset(@RequestBody CcerTransfer transfer) {
        return R.ok(service.applyCcerOffset(transfer));
    }

    @GetMapping("/ccer-transfers")
    @Operation(summary = "查询某年度 CCER 抵消记录")
    public R<List<CcerTransfer>> list(@RequestParam Integer year) {
        return R.ok(service.listCcerTransfers(year));
    }
}

package com.mw.scheduling.controller;

import com.mw.common.response.ApiResponse;
import com.mw.common.response.PageResult;
import com.mw.scheduling.document.DispatchOrder;
import com.mw.scheduling.document.StopNode;
import com.mw.scheduling.dto.PlanRequest;
import com.mw.scheduling.dto.PlanResultDTO;
import com.mw.scheduling.dto.UrgentInsertRequest;
import com.mw.scheduling.service.TransferSchedulingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "转运调度", description = "路线规划、紧急插单、人工调整、司机确认")
@RestController
@RequestMapping("/scheduling")
@RequiredArgsConstructor
public class SchedulingController {

    private final TransferSchedulingService schedulingService;

    @Operation(summary = "贪心算法生成日收运路线方案")
    @PostMapping("/plan")
    public ApiResponse<PlanResultDTO> plan(@Valid @RequestBody PlanRequest request) {
        return ApiResponse.success(schedulingService.planDailyRoute(request));
    }

    @Operation(summary = "紧急插单调度")
    @PostMapping("/urgent")
    public ApiResponse<DispatchOrder> urgent(@Valid @RequestBody UrgentInsertRequest request) {
        return ApiResponse.success(schedulingService.urgentInsert(request));
    }

    @Operation(summary = "人工调整派单路线")
    @PostMapping("/{orderNo}/adjust")
    public ApiResponse<DispatchOrder> adjust(@PathVariable String orderNo,
                                              @RequestBody List<StopNode> newRoute) {
        return ApiResponse.success(schedulingService.manualAdjust(orderNo, newRoute));
    }

    @Operation(summary = "司机确认收运")
    @PostMapping("/{orderNo}/accept")
    public ApiResponse<DispatchOrder> accept(@PathVariable String orderNo) {
        return ApiResponse.success(schedulingService.acceptOrder(orderNo));
    }

    @Operation(summary = "分页查询派单")
    @GetMapping("/orders")
    public ApiResponse<PageResult<DispatchOrder>> orders(
            @RequestParam(required = false) String vehicleId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<DispatchOrder> all = schedulingService.listOrders(vehicleId, status, page, size);
        return ApiResponse.success(PageResult.of(all, all.size(), page, size));
    }
}

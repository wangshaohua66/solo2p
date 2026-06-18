package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.SupplierVoucherRequest;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.entity.SupplierOrderEntity;
import com.wedding.suite.service.impl.PortalService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/portal")
public class PortalController {

    private final PortalService portalService;

    public PortalController(PortalService portalService) {
        this.portalService = portalService;
    }

    @GetMapping("/schedule/{supplierId}")
    public ApiResponse<List<ScheduleTaskEntity>> schedule(@PathVariable Long supplierId) {
        return ApiResponse.ok(portalService.schedule(supplierId));
    }

    @GetMapping("/orders/{supplierId}")
    public ApiResponse<List<SupplierOrderEntity>> orders(@PathVariable Long supplierId) {
        return ApiResponse.ok(portalService.orders(supplierId));
    }

    @PostMapping("/orders/{id}/confirm")
    public ApiResponse<SupplierOrderEntity> confirmOrder(@PathVariable Long id) {
        return ApiResponse.ok(portalService.confirmOrder(id));
    }

    @PostMapping("/orders/{id}/voucher")
    public ApiResponse<SupplierOrderEntity> submitVoucher(@PathVariable Long id,
                                                          @Valid @RequestBody SupplierVoucherRequest req) {
        return ApiResponse.ok(portalService.submitVoucher(id, req));
    }
}

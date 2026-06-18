package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.SupplierVoucherRequest;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.entity.SupplierOrderEntity;
import com.wedding.suite.enums.SupplierOrderStatus;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ScheduleTaskRepository;
import com.wedding.suite.repository.SupplierOrderRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PortalService {

    private final ScheduleTaskRepository scheduleRepo;
    private final SupplierOrderRepository orderRepo;

    public PortalService(ScheduleTaskRepository scheduleRepo, SupplierOrderRepository orderRepo) {
        this.scheduleRepo = scheduleRepo;
        this.orderRepo = orderRepo;
    }

    public List<ScheduleTaskEntity> schedule(Long supplierId) {
        return scheduleRepo.findStaffSchedule(supplierId);
    }

    public List<SupplierOrderEntity> orders(Long supplierId) {
        return orderRepo.findAll();
    }

    public SupplierOrderEntity confirmOrder(Long id) {
        SupplierOrderEntity o = orderRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));
        o.setStatus(SupplierOrderStatus.CONFIRMED);
        return orderRepo.save(o);
    }

    public SupplierOrderEntity submitVoucher(Long id, SupplierVoucherRequest req) {
        SupplierOrderEntity o = orderRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));
        o.setVoucherUrl(req.getFileUrl());
        o.setStatus(SupplierOrderStatus.DONE);
        return orderRepo.save(o);
    }
}

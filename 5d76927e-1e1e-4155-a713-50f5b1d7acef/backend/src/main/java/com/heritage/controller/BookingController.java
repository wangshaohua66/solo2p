package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.Booking;
import com.heritage.enums.BookingStatus;
import com.heritage.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/bookings")
@Tag(name = "研学预约管理", description = "研学预约申请、审批、查询API")
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @GetMapping
    @Operation(summary = "查询所有预约")
    public ApiResponse<Page<Booking>> getAllBookings(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Booking> result = status != null
                ? bookingService.getBookingsByStatus(status, pageable)
                : bookingService.getAllBookings(pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取预约详情")
    public ApiResponse<Booking> getBookingById(@PathVariable String id) {
        Booking booking = bookingService.getBookingById(id);
        if (booking == null) {
            return ApiResponse.error(404, "预约不存在");
        }
        return ApiResponse.success(booking);
    }

    @GetMapping("/my")
    @Operation(summary = "查询我的预约", description = "研学机构查询自己发起的预约")
    public ApiResponse<Page<Booking>> getMyBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String institutionId = auth.getName();
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.success(bookingService.getBookingsByInstitution(institutionId, pageable));
    }

    @GetMapping("/inheritor/{inheritorId}")
    @Operation(summary = "查询传承人预约")
    public ApiResponse<Page<Booking>> getBookingsByInheritor(
            @PathVariable String inheritorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.success(bookingService.getBookingsByInheritor(inheritorId, pageable));
    }

    @GetMapping("/calendar/{inheritorId}")
    @Operation(summary = "查询传承人某月预约日历", description = "查询指定传承人在指定月份内的所有预约")
    public ApiResponse<List<Booking>> getBookingCalendar(
            @PathVariable String inheritorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {

        return ApiResponse.success(bookingService.getBookingsInDateRange(inheritorId, start, end));
    }

    @PostMapping("/check-conflict")
    @Operation(summary = "检查时间冲突", description = "检查指定传承人在指定时间段是否已有预约")
    public ApiResponse<Map<String, Boolean>> checkConflict(
            @RequestParam String inheritorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {

        boolean conflict = bookingService.hasConflict(inheritorId, startTime, endTime);
        return ApiResponse.success(Map.of("hasConflict", conflict));
    }

    @PostMapping
    @Operation(summary = "提交预约申请")
    public ApiResponse<Booking> createBooking(@RequestBody Booking booking) {
        try {
            Booking created = bookingService.createBooking(booking);
            return ApiResponse.success("预约申请已提交", created);
        } catch (RuntimeException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @PutMapping("/{id}/approve")
    @Operation(summary = "批准预约")
    public ApiResponse<Booking> approveBooking(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String approverId = auth.getName();
        String remark = body != null ? body.getOrDefault("remark", "") : "";
        Booking updated = bookingService.approveBooking(id, approverId, remark);
        return ApiResponse.success("预约已批准", updated);
    }

    @PutMapping("/{id}/reject")
    @Operation(summary = "拒绝预约")
    public ApiResponse<Booking> rejectBooking(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String approverId = auth.getName();
        String remark = body != null ? body.getOrDefault("remark", "拒绝原因未说明") : "拒绝原因未说明";
        Booking updated = bookingService.rejectBooking(id, approverId, remark);
        return ApiResponse.success("预约已拒绝", updated);
    }

    @PutMapping("/{id}/cancel")
    @Operation(summary = "取消预约")
    public ApiResponse<Booking> cancelBooking(@PathVariable String id) {
        Booking updated = bookingService.cancelBooking(id);
        return ApiResponse.success("预约已取消", updated);
    }
}

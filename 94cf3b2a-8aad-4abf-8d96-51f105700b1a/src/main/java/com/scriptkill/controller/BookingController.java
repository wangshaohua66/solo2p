package com.scriptkill.controller;

import com.scriptkill.dto.booking.BookingCreateRequest;
import com.scriptkill.dto.booking.BookingResponse;
import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.risk.PlayerRiskInfo;
import com.scriptkill.service.AuthService;
import com.scriptkill.service.BookingService;
import com.scriptkill.service.RiskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@Tag(name = "player", description = "预约、定金、爽约风控")
public class BookingController {

    private final BookingService bookingService;
    private final RiskService riskService;
    private final AuthService authService;

    public BookingController(BookingService bookingService,
                             RiskService riskService,
                             AuthService authService) {
        this.bookingService = bookingService;
        this.riskService = riskService;
        this.authService = authService;
    }

    @PostMapping
    @Operation(summary = "创建预约", description = "玩家预约场次，自动计算定金")
    public ApiResponse<BookingResponse> createBooking(
            @Valid @RequestBody BookingCreateRequest request) {
        BookingResponse response = bookingService.createBooking(request);
        return ApiResponse.success("预约成功", response);
    }

    @PostMapping("/{bookingId}/cancel")
    @Operation(summary = "取消预约", description = "玩家取消预约，根据取消时间计算定金退还")
    public ApiResponse<BookingResponse> cancelBooking(
            @Parameter(description = "预约ID") @PathVariable Long bookingId,
            @Parameter(description = "取消原因") @RequestParam(required = false) String reason) {
        Long userId = authService.getCurrentUser().getId();
        BookingResponse response = bookingService.cancelBooking(bookingId, reason, userId);
        return ApiResponse.success("预约已取消", response);
    }

    @PostMapping("/{bookingId}/check-in")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "玩家签到", description = "DM确认玩家到场签到")
    public ApiResponse<BookingResponse> checkIn(
            @Parameter(description = "预约ID") @PathVariable Long bookingId) {
        Long dmUserId = authService.getCurrentUser().getId();
        BookingResponse response = bookingService.checkIn(bookingId, dmUserId);
        return ApiResponse.success("签到成功", response);
    }

    @PostMapping("/{bookingId}/no-show")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "标记爽约", description = "DM标记玩家爽约，扣除定金并降低信用分")
    public ApiResponse<Void> markNoShow(
            @Parameter(description = "预约ID") @PathVariable Long bookingId) {
        Long dmUserId = authService.getCurrentUser().getId();
        bookingService.markNoShow(bookingId, dmUserId);
        return ApiResponse.success("已标记为爽约", null);
    }

    @GetMapping("/session/{sessionId}")
    @Operation(summary = "获取场次预约列表", description = "查看某场次的所有预约")
    public ApiResponse<List<BookingResponse>> getSessionBookings(
            @Parameter(description = "会话ID") @PathVariable Long sessionId) {
        List<BookingResponse> bookings = bookingService.getSessionBookings(sessionId);
        return ApiResponse.success(bookings);
    }

    @GetMapping("/player/{playerId}")
    @Operation(summary = "获取玩家预约列表", description = "查看某玩家的所有预约")
    public ApiResponse<List<BookingResponse>> getPlayerBookings(
            @Parameter(description = "玩家ID") @PathVariable Long playerId) {
        List<BookingResponse> bookings = bookingService.getPlayerBookings(playerId);
        return ApiResponse.success(bookings);
    }

    @GetMapping("/risk/{playerId}")
    @Operation(summary = "获取玩家风控信息", description = "查看玩家信用分、爽约率、风险等级")
    public ApiResponse<PlayerRiskInfo> getPlayerRiskInfo(
            @Parameter(description = "玩家ID") @PathVariable Long playerId) {
        PlayerRiskInfo info = riskService.getPlayerRiskInfo(playerId);
        return ApiResponse.success(info);
    }
}

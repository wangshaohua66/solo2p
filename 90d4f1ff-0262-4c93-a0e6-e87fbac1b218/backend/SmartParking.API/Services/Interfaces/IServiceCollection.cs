using SmartParking.API.Common;
using SmartParking.API.Models.DTOs;

namespace SmartParking.API.Services.Interfaces;

public interface IAuthService
{
    Task<ApiResponse<LoginResponse>> LoginAsync(LoginRequest request);
    Task<ApiResponse<LoginResponse>> RefreshTokenAsync(RefreshTokenRequest request);
    Task<ApiResponse<UserDto>> GetProfileAsync(string userId);
    Task<ApiResponse> LogoutAsync(string userId);
}

public interface IParkingService
{
    Task<ApiResponse<List<ParkingLotDto>>> GetAllLotsAsync();
    Task<ApiResponse<ParkingLotDto>> GetLotByIdAsync(string lotId);
    Task<ApiResponse<ParkingRecordDto>> EntryParkingAsync(ParkingEntryRequest request, string? userId);
    Task<ApiResponse<(ParkingRecordDto Record, decimal Fee)>> ExitParkingAsync(ParkingExitRequest request);
    Task<ApiResponse<PagedResult<ParkingRecordDto>>> GetRecordsAsync(PagedQuery query, string? status);
}

public interface IChargingService
{
    Task<ApiResponse<List<ChargingStationDto>>> GetStationsAsync(string? parkingLotId, string? status);
    Task<ApiResponse<ChargingStationDto>> GetStationByIdAsync(string stationId);
    Task<ApiResponse<ChargingReservationDto>> CreateReservationAsync(CreateReservationRequest request, string userId);
    Task<ApiResponse> CancelReservationAsync(string reservationId, string userId);
    Task<ApiResponse<PagedResult<ChargingReservationDto>>> GetReservationsAsync(PagedQuery query, string? status, string? userId);
    Task<ApiResponse<ChargingSessionDto>> StartChargingAsync(string stationId, string userId);
    Task<ApiResponse<ChargingSessionDto>> StopChargingAsync(string sessionId, string userId);
    Task<ApiResponse<PagedResult<ChargingSessionDto>>> GetSessionsAsync(PagedQuery query, string? status, string? userId);
    Task<ApiResponse<List<AvailableSlotDto>>> GetAvailableSlotsAsync(string stationId, string date);
}

public interface IBillingService
{
    Task<ApiResponse<BillingCalculationDto>> CalculateParkingAsync(BillingCalculationRequest request);
    Task<ApiResponse<BillingCalculationDto>> CalculateChargingAsync(ChargingBillingRequest request);
    Task<ApiResponse<PaymentOrderDto>> CreateOrderAsync(CreatePaymentOrderRequest request, string userId);
    Task<ApiResponse<PayOrderResponse>> PayOrderAsync(string orderId, PayOrderRequest request, string userId);
    Task<ApiResponse> RefundOrderAsync(RefundRequest request, string userId);
    Task<ApiResponse<PagedResult<PaymentOrderDto>>> GetOrdersAsync(PagedQuery query, string? status, string? type, string? userId);
    Task<ApiResponse<PaymentOrderDto>> GetOrderByIdAsync(string orderId, string userId);
    Task<ApiResponse<GenerateInvoiceResponse>> GenerateInvoiceAsync(string orderId, string userId);
    Task<ApiResponse<List<BillingRuleDto>>> GetRulesAsync();
    Task<ApiResponse<BillingRuleDto>> CreateRuleAsync(BillingRuleDto request);
    Task<ApiResponse<BillingRuleDto>> UpdateRuleAsync(string ruleId, BillingRuleDto request);
    Task<ApiResponse> ToggleRuleAsync(string ruleId, bool isEnabled);
}

public interface IDashboardService
{
    Task<ApiResponse<DashboardStatsDto>> GetStatsAsync(string period = "day");
}

public interface IPaymentService
{
    Task<(bool Success, string? TransactionId, string? ErrorMessage)> ProcessWeChatPayAsync(PaymentOrderDto order);
    Task<(bool Success, string? TransactionId, string? ErrorMessage)> ProcessAlipayAsync(PaymentOrderDto order);
    Task<(bool Success, string? ErrorMessage)> ProcessBalancePayAsync(PaymentOrderDto order, string userId);
    Task<(bool Success, string? ErrorMessage)> RefundAsync(PaymentOrderDto order, decimal refundAmount, bool fullRefund);
}

public interface IWorkOrderService
{
    Task<ApiResponse<PagedResult<WorkOrderDto>>> GetWorkOrdersAsync(PagedQuery query, string? status, string? assigneeId);
    Task<ApiResponse<WorkOrderDto>> CreateWorkOrderAsync(CreateWorkOrderRequest request, string reporterId);
    Task<ApiResponse<WorkOrderDto>> AssignWorkOrderAsync(string orderId, string assigneeId);
    Task<ApiResponse<WorkOrderDto>> UpdateStatusAsync(string orderId, WorkOrderStatus status);
    Task<ApiResponse<WorkOrderDto>> GetByIdAsync(string orderId);
}

public interface INotificationService
{
    Task NotifyUserAsync(string userId, string message, string type = "info");
    Task NotifyAllAsync(string message, string type = "info");
}

public interface IRedisCacheService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null);
    Task RemoveAsync(string key);
    Task<bool> ExistsAsync(string key);
    Task RefreshParkingSpotAsync(string spotId, ParkingSpotDto spot);
    Task<ParkingSpotDto?> GetParkingSpotAsync(string spotId);
    Task RefreshChargingStationAsync(string stationId, ChargingStationDto station);
    Task<ChargingStationDto?> GetChargingStationAsync(string stationId);
}

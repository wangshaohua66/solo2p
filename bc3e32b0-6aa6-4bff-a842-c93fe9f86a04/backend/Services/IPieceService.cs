using PotteryStudio.Models;

namespace PotteryStudio.Services;

public interface IPieceService
{
    Task<PagedResult<PieceArchive>> GetPiecesAsync(PagedQuery query, Guid? memberId = null, 
        PieceStatus? status = null, PhotoStage? stage = null, string? search = null);
    Task<PieceArchive?> GetPieceByIdAsync(Guid id);
    Task<PieceArchive> CreatePieceAsync(PieceArchive piece);
    Task<PieceArchive> UpdatePieceAsync(Guid id, PieceArchive piece);
    Task DeletePieceAsync(Guid id);
    Task<PiecePhoto> AddPhotoAsync(Guid pieceId, PiecePhoto photo);
    Task<PiecePhoto> UpdatePhotoAsync(Guid photoId, PiecePhoto photo);
    Task DeletePhotoAsync(Guid photoId);
    Task<List<PiecePhoto>> GetPiecePhotosAsync(Guid pieceId);
    Task<PieceArchive> UpdateStatusAsync(Guid id, PieceStatus status);
}

public interface ICourseService
{
    Task<PagedResult<Course>> GetCoursesAsync(PagedQuery query, CourseType? type = null, 
        CourseLevel? level = null, CourseStatus? status = null);
    Task<Course?> GetCourseByIdAsync(Guid id);
    Task<Course> CreateCourseAsync(Course course);
    Task<Course> UpdateCourseAsync(Guid id, Course course);
    Task DeleteCourseAsync(Guid id);
    Task<CourseRegistration> RegisterCourseAsync(Guid courseId, Guid memberId, string memberName);
    Task CancelRegistrationAsync(Guid registrationId, Guid memberId);
    Task<List<CourseRegistration>> GetCourseRegistrationsAsync(Guid courseId);
    Task<AttendanceRecord> CheckInAsync(Guid sessionId, Guid memberId);
    Task<string> GenerateQrCodeAsync(Guid sessionId);
    Task<List<AttendanceRecord>> GetSessionAttendanceAsync(Guid sessionId);
    Task<List<CourseSession>> GetCourseSessionsAsync(Guid courseId);
}

public interface IStudioService
{
    Task<List<Station>> GetStationsAsync(StationType? type = null);
    Task<Station?> GetStationByIdAsync(Guid id);
    Task<Station> CreateStationAsync(Station station);
    Task<Station> UpdateStationAsync(Guid id, Station station);
    Task DeleteStationAsync(Guid id);
    
    Task<List<StudioBooking>> GetBookingsAsync(DateTime? date = null, Guid? stationId = null, Guid? memberId = null);
    Task<StudioBooking?> GetBookingByIdAsync(Guid id);
    Task<StudioBooking> CreateBookingAsync(StudioBooking booking);
    Task CancelBookingAsync(Guid bookingId, Guid memberId);
    Task<StudioBooking> CheckInAsync(Guid bookingId);
    Task<StudioBooking> CheckOutAsync(Guid bookingId);
    
    Task<int> GetOccupancyAsync(DateTime date);
    Task<bool> CheckAvailabilityAsync(Guid stationId, DateTime startTime, DateTime endTime, Guid? excludeId = null);
}

public interface ISalesService
{
    Task<PagedResult<SalesItem>> GetSalesItemsAsync(PagedQuery query, SalesStatus? status = null);
    Task<SalesItem?> GetSalesItemByIdAsync(Guid id);
    Task<SalesItem> CreateSalesItemAsync(SalesItem item);
    Task<SalesItem> UpdateSalesItemAsync(Guid id, SalesItem item);
    Task DeleteSalesItemAsync(Guid id);
    Task<SalesItem> MarkAsSoldAsync(Guid id, string buyerName, string buyerContact);
    
    Task<PagedResult<CustomOrder>> GetCustomOrdersAsync(PagedQuery query, OrderStatus? status = null);
    Task<CustomOrder?> GetCustomOrderByIdAsync(Guid id);
    Task<CustomOrder> CreateCustomOrderAsync(CustomOrder order);
    Task<CustomOrder> UpdateCustomOrderAsync(Guid id, CustomOrder order);
    Task<CustomOrder> UpdateStatusAsync(Guid id, OrderStatus status);
    Task<CustomOrder> SubmitQuoteAsync(Guid id, decimal quoteAmount);
}

public interface IInventoryService
{
    Task<PagedResult<Material>> GetMaterialsAsync(PagedQuery query, MaterialCategory? category = null);
    Task<Material?> GetMaterialByIdAsync(Guid id);
    Task<Material> CreateMaterialAsync(Material material);
    Task<Material> UpdateMaterialAsync(Guid id, Material material);
    Task DeleteMaterialAsync(Guid id);
    
    Task<PagedResult<MaterialTransaction>> GetTransactionsAsync(PagedQuery query, Guid? materialId = null,
        TransactionType? type = null);
    Task<MaterialTransaction> AddTransactionAsync(MaterialTransaction transaction);
    
    Task<List<MaterialAlert>> GetAlertsAsync(bool? isRead = null);
    Task MarkAlertAsReadAsync(Guid alertId);
    Task<List<PurchaseSuggestion>> GeneratePurchaseSuggestionsAsync();
    Task CheckInventoryAlertsAsync();
    
    Task DeductMaterialForPieceAsync(Guid pieceId, Dictionary<Guid, decimal> materialUsage);
}

public interface INotificationService
{
    Task<List<Notification>> GetUserNotificationsAsync(Guid userId, bool? isRead = null, int limit = 50);
    Task<Notification> CreateNotificationAsync(Guid userId, string title, string content, 
        NotificationType type = NotificationType.System, string? link = null);
    Task MarkAsReadAsync(Guid notificationId);
    Task MarkAllAsReadAsync(Guid userId);
    Task<int> GetUnreadCountAsync(Guid userId);
}

using PotteryStudio.Models;

namespace PotteryStudio.Services;

public interface IKilnService
{
    Task<List<Kiln>> GetKilnsAsync();
    Task<Kiln?> GetKilnByIdAsync(Guid id);
    Task<Kiln> CreateKilnAsync(Kiln kiln);
    Task<Kiln> UpdateKilnAsync(Guid id, Kiln kiln);
    Task DeleteKilnAsync(Guid id);
    
    Task<List<KilnSchedule>> GetSchedulesAsync(Guid? kilnId = null, DateTime? startDate = null, 
        DateTime? endDate = null, FiringType? firingType = null, ScheduleStatus? status = null);
    Task<KilnSchedule?> GetScheduleByIdAsync(Guid id);
    Task<KilnSchedule> CreateScheduleAsync(KilnSchedule schedule, bool forceOverride = false);
    Task<KilnSchedule> UpdateScheduleAsync(Guid id, KilnSchedule schedule, bool forceOverride = false);
    Task DeleteScheduleAsync(Guid id);
    Task<ConflictResult> CheckConflictAsync(Guid kilnId, DateTime startTime, DateTime endTime, Guid? excludeId = null);
    Task<KilnSchedule> StartFiringAsync(Guid scheduleId);
    Task<KilnSchedule> CompleteFiringAsync(Guid scheduleId);
    Task<KilnSchedule> CancelScheduleAsync(Guid scheduleId);
    Task<PagedResult<FiringRecord>> GetFiringRecordsAsync(Guid? kilnId = null, PagedQuery? query = null);
}

public interface IGlazeRecipeService
{
    Task<PagedResult<GlazeRecipe>> GetRecipesAsync(PagedQuery query, FiringType? firingType = null, bool? isArchived = null);
    Task<GlazeRecipe?> GetRecipeByIdAsync(Guid id);
    Task<List<GlazeRecipe>> GetRecipeTreeAsync(Guid? rootId = null);
    Task<List<GlazeRecipe>> GetRecipeVersionsAsync(Guid recipeId);
    Task<List<GlazeRecipe>> GetRecipeLineageAsync(Guid recipeId);
    Task<GlazeRecipe> CreateRecipeAsync(GlazeRecipe recipe, Guid? createdById, string createdByName);
    Task<GlazeRecipe> UpdateRecipeAsync(Guid id, GlazeRecipe recipe);
    Task DeleteRecipeAsync(Guid id);
    Task<GlazeRecipe> CloneRecipeAsync(Guid id, string newName, Guid createdById, string createdByName);
    Task<GlazeRecipe> CreateVersionAsync(Guid parentId, GlazeRecipe recipe, Guid createdById, string createdByName);
    Task<GlazeRecipe> ArchiveRecipeAsync(Guid id);
    Task<GlazeRecipe> UnarchiveRecipeAsync(Guid id);
    Task<GlazeRecipe> UploadEffectImageAsync(Guid id, string imageUrl, string thumbnailUrl);
}

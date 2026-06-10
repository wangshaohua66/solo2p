using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using CampHub.Models;
using CampHub.Services;

namespace CampHub.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
[Produces("application/json")]
public class StatsController : ControllerBase
{
    private readonly MongoContext _db;

    public StatsController(MongoContext db) { _db = db; }

    private string CurrentUserId => JwtService.GetUserIdFromClaims(User) ?? "";

    [HttpGet("seasonality")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<SeasonalityCellDto>>>> Seasonality()
    {
        var ratings = await _db.Ratings.Find(_ => true).ToListAsync();
        var groups = ratings
            .Where(r => r.Season >= 1 && r.Season <= 12 && !string.IsNullOrWhiteSpace(r.DestinationTag))
            .GroupBy(r => new { r.Season, Tag = r.DestinationTag.Trim() })
            .Select(g => new SeasonalityCellDto
            {
                Month = g.Key.Season,
                DestinationTag = g.Key.Tag,
                AvgScore = Math.Round(new[] { g.Average(x => x.TransportationScore), g.Average(x => x.SceneryScore), g.Average(x => x.FacilityScore), g.Average(x => x.SafetyScore) }.Average(), 2),
                SampleCount = g.Count()
            })
            .ToList();
        return Ok(ApiResponse<List<SeasonalityCellDto>>.Ok(groups));
    }

    [HttpGet("credit-rank")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<CreditRankDto>>>> CreditRank([FromQuery] int top = 20)
    {
        var users = await _db.Users.Find(_ => true).Limit(Math.Max(5, Math.Min(top, 100))).ToListAsync();
        var userIds = users.Select(u => u.Id).ToList();

        var lendCounts = await _db.BorrowRecords.Aggregate()
            .Match(Builders<BorrowRecord>.Filter.In(br => br.BorrowerId, userIds))
            .Group(br => br.BorrowerId, g => new { UserId = g.Key, Count = g.Count(), OnTime = g.Count(x => !x.ActualReturnDate.HasValue || x.ActualReturnDate <= x.DueDate) })
            .ToListAsync();

        var rankMap = lendCounts.ToDictionary(x => x.UserId, x => new { x.Count, x.OnTime });
        var ranked = users
            .Select(u =>
            {
                var lc = rankMap.TryGetValue(u.Id, out var m) ? m.Count : 0;
                var ot = rankMap.TryGetValue(u.Id, out var m2) && m2.Count > 0 ? (int)Math.Round((double)m2.OnTime / m2.Count * 100) : 100;
                return new CreditRankDto
                {
                    User = JwtService.MapToUserDto(u),
                    Score = u.CreditScore,
                    LendCount = lc,
                    OnTimeRate = ot
                };
            })
            .OrderByDescending(r => r.Score)
            .ThenByDescending(r => r.OnTimeRate)
            .Take(top)
            .ToList();
        for (int i = 0; i < ranked.Count; i++) ranked[i].Rank = i + 1;
        return Ok(ApiResponse<List<CreditRankDto>>.Ok(ranked));
    }

    [HttpGet("gear-usage")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<GearDto>>>> GearUsage([FromQuery] int top = 10)
    {
        var list = await _db.Gears.Find(_ => true)
            .Sort(Builders<Gear>.Sort.Descending(g => g.UsageCount))
            .Limit(Math.Max(1, Math.Min(top, 50)))
            .ToListAsync();
        var ownerIds = list.Select(g => g.OwnerId).Distinct().ToList();
        var ownerMap = (await _db.Users.Find(Builders<User>.Filter.In(u => u.Id, ownerIds)).ToListAsync())
            .ToDictionary(u => u.Id);
        var dtos = list.Select(g => new GearDto
        {
            Id = g.Id,
            OwnerId = g.OwnerId,
            Owner = ownerMap.TryGetValue(g.OwnerId, out var u) ? JwtService.MapToUserDto(u) : null,
            Name = g.Name,
            Category = g.Category,
            Description = g.Description ?? "",
            ImageUrl = g.ImageUrl ?? "",
            Status = g.Status,
            PurchasePrice = g.PurchasePrice,
            UsageCount = g.UsageCount,
            WearLevel = g.WearLevel,
            LastMaintenanceDate = g.LastMaintenanceDate,
            NextMaintenanceAfterUses = g.NextMaintenanceAfterUses,
            CurrentBorrowerId = g.CurrentBorrowerId,
            DueDate = g.DueDate,
            NeedsMaintenance = g.NeedsMaintenance
        }).ToList();
        return Ok(ApiResponse<List<GearDto>>.Ok(dtos));
    }

    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<StatsOverviewDto>>> Overview()
    {
        var uid = CurrentUserId;
        var user = uid.Length > 0 ? await _db.Users.Find(u => u.Id == uid).FirstOrDefaultAsync() : null;
        var meFilter = Builders<CampEvent>.Filter.Or(
            Builders<CampEvent>.Filter.Eq(e => e.CreatorId, uid),
            Builders<CampEvent>.Filter.AnyEq(e => e.Participants,
                Builders<Participant>.Filter.Eq(p => p.UserId, uid))
        );
        var counts = await _db.Events.CountDocumentsAsync(string.IsNullOrEmpty(uid) ? _ => true : meFilter);
        var gearCount = await _db.Gears.CountDocumentsAsync(string.IsNullOrEmpty(uid) ? _ => true : g => g.OwnerId == uid);
        var photoCount = await _db.Photos.CountDocumentsAsync(string.IsNullOrEmpty(uid) ? _ => true : ph => ph.UploaderId == uid);
        var pendingCount = await _db.BorrowRecords.CountDocumentsAsync(
            Builders<BorrowRecord>.Filter.Eq(b => b.LenderId, uid)
            & Builders<BorrowRecord>.Filter.Eq(b => b.ActualReturnDate, null));

        return Ok(ApiResponse<StatsOverviewDto>.Ok(new StatsOverviewDto
        {
            TotalEvents = (int)counts,
            TotalGear = (int)gearCount,
            PendingReturns = (int)pendingCount,
            TotalPhotos = (int)photoCount,
            MyCreditScore = user?.CreditScore ?? 0
        }));
    }
}

[Route("Stats")]
public class StatsMvcController : Controller
{
    public IActionResult Index() => View();
}

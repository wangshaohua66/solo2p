using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using CampHub.Models;
using CampHub.Services;

namespace CampHub.Controllers;

public class HomeController : Controller
{
    private readonly MongoContext _db;

    public HomeController(MongoContext db)
    {
        _db = db;
    }

    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated != true)
            return Redirect("/Account/Login");
        return View("~/Views/Home/Index.cshtml");
    }

    public IActionResult Error() => Problem();
}

[Route("api/home")]
[ApiController]
[Authorize]
[Produces("application/json")]
public class HomeApiController : ControllerBase
{
    private readonly MongoContext _db;
    private readonly RecommendationService _reco;

    public HomeApiController(MongoContext db, RecommendationService reco)
    {
        _db = db;
        _reco = reco;
    }

    private string CurrentUserId => JwtService.GetUserIdFromClaims(User) ?? "";

    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<StatsOverviewDto>>> Overview()
    {
        var uid = CurrentUserId;
        var user = await _db.Users.Find(u => u.Id == uid).FirstOrDefaultAsync();
        var now = DateTime.UtcNow;

        var totalEvents = await _db.Events
            .CountDocumentsAsync(e => e.CreatorId == uid ||
                e.Participants.Any(p => p.UserId == uid));

        var totalGear = await _db.Gears.CountDocumentsAsync(g => g.OwnerId == uid);

        var pendingReturns = await _db.Gears.CountDocumentsAsync(g =>
            g.OwnerId == uid && g.Status == GearStatus.Lent ||
            g.CurrentBorrowerId == uid);

        var totalPhotos = await _db.Photos.CountDocumentsAsync(p => p.UploaderId == uid);

        return Ok(ApiResponse<StatsOverviewDto>.Ok(new StatsOverviewDto
        {
            TotalEvents = (int)totalEvents,
            TotalGear = (int)totalGear,
            PendingReturns = (int)pendingReturns,
            TotalPhotos = (int)totalPhotos,
            MyCreditScore = user?.CreditScore ?? 0
        }));
    }

    [HttpGet("upcoming")]
    public async Task<ActionResult<ApiResponse<List<EventDto>>>> Upcoming(
        [FromQuery] int limit = 6)
    {
        var uid = CurrentUserId;
        var now = DateTime.UtcNow;

        var events = await _db.Events
            .Find(e => (e.CreatorId == uid ||
                        e.Participants.Any(p => p.UserId == uid))
                       && e.EndTime > now
                       && e.Status != EventStatus.Archived)
            .SortBy(e => e.StartTime)
            .Limit(limit)
            .ToListAsync();

        var userIds = events.SelectMany(e => new[] { e.CreatorId }
            .Concat(e.Participants.Select(p => p.UserId))).Distinct().ToList();
        var userMap = (await _db.Users.Find(u => userIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id, JwtService.MapToUserDto);

        var dtos = events.Select(ev => new EventDto
        {
            Id = ev.Id, CreatorId = ev.CreatorId,
            Creator = userMap.GetValueOrDefault(ev.CreatorId),
            Title = ev.Title, Destination = ev.Destination,
            GeoLocation = ev.GeoLocation,
            StartTime = ev.StartTime, EndTime = ev.EndTime,
            MaxParticipants = ev.MaxParticipants,
            Status = ev.Status, Description = ev.Description,
            CoverImage = ev.CoverImage,
            Participants = ev.Participants.Select(p => new ParticipantDto
            {
                UserId = p.UserId, User = userMap.GetValueOrDefault(p.UserId),
                Role = p.Role, Confirmed = p.Confirmed
            }).ToList(),
            Version = ev.Version, CreatedAt = ev.CreatedAt
        }).ToList();

        return Ok(ApiResponse<List<EventDto>>.Ok(dtos));
    }
}

[Route("Stats")]
public class StatsMvcController : Controller
{
    public IActionResult Index() => User.Identity?.IsAuthenticated != true
        ? Redirect("/Account/Login?returnUrl=/Stats")
        : View("~/Views/Stats/Index.cshtml");
}

[Route("api/stats")]
[ApiController]
[Authorize]
[Produces("application/json")]
public class StatsApiController : ControllerBase
{
    private readonly MongoContext _db;
    private readonly RecommendationService _reco;

    public StatsApiController(MongoContext db, RecommendationService reco)
    {
        _db = db;
        _reco = reco;
    }

    [HttpGet("seasonality")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<SeasonalityCellDto>>>> Seasonality()
    {
        var matrix = await _reco.ComputeSeasonalityMatrix();
        return Ok(ApiResponse<List<SeasonalityCellDto>>.Ok(matrix));
    }

    [HttpGet("credit-rank")]
    public async Task<ActionResult<ApiResponse<List<CreditRankDto>>>> CreditRank(
        [FromQuery] int top = 20)
    {
        var users = await _db.Users
            .Find(_ => true)
            .SortByDescending(u => u.CreditScore)
            .Limit(top)
            .ToListAsync();

        var userIds = users.Select(u => u.Id).ToList();
        var borrowGrouped = await _db.BorrowRecords
            .Aggregate()
            .Match(b => userIds.Contains(b.BorrowerId))
            .Group(b => b.BorrowerId, g => new
            {
                UserId = g.Key,
                Count = g.Count(),
                OnTimeCount = g.Sum(b =>
                    b.ActualReturnDate <= b.DueDate ? 1 : 0)
            })
            .ToListAsync();

        var ranks = new List<CreditRankDto>();
        for (int i = 0; i < users.Count; i++)
        {
            var u = users[i];
            var stat = borrowGrouped.FirstOrDefault(b => b.UserId == u.Id);
            ranks.Add(new CreditRankDto
            {
                User = JwtService.MapToUserDto(u),
                Rank = i + 1,
                Score = u.CreditScore,
                LendCount = stat?.Count ?? 0,
                OnTimeRate = stat == null || stat.Count == 0
                    ? 100 : (int)Math.Round(100.0 * stat.OnTimeCount / stat.Count)
            });
        }
        return Ok(ApiResponse<List<CreditRankDto>>.Ok(ranks));
    }

    [HttpGet("gear-usage")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GearUsage([FromQuery] int top = 10)
    {
        var uid = JwtService.GetUserIdFromClaims(User) ?? "";
        var topGear = await _db.Gears
            .Find(g => g.OwnerId == uid)
            .SortByDescending(g => g.UsageCount)
            .Limit(top)
            .Project(g => new
            {
                g.Id, g.Name, g.Category, g.ImageUrl,
                g.UsageCount, g.WearLevel, g.Status
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(topGear.Cast<object>().ToList()));
    }
}

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
public class EventController : ControllerBase
{
    private readonly MongoContext _db;
    private readonly RecommendationService _reco;

    public EventController(MongoContext db, RecommendationService reco)
    {
        _db = db;
        _reco = reco;
    }

    private string CurrentUserId => JwtService.GetUserIdFromClaims(User) ?? "";

    [HttpGet("list")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<EventDto>>>> List(
        [FromQuery] EventQueryDto q)
    {
        var fb = Builders<CampEvent>.Filter;
        var filter = fb.Empty;

        if (!string.IsNullOrEmpty(q.Status))
            filter &= fb.Eq(e => e.Status, q.Status);

        var uid = CurrentUserId;
        if (!string.IsNullOrEmpty(uid))
        {
            filter &= fb.Or(
                fb.Eq(e => e.CreatorId, uid),
                fb.AnyEq(e => e.Participants,
                    Builders<Participant>.Filter.Eq(p => p.UserId, uid))
            );
        }

        if (q.Range == "upcoming")
            filter &= fb.Gte(e => e.EndTime, DateTime.UtcNow.AddDays(-1));
        else if (q.Range == "past")
            filter &= fb.Lt(e => e.EndTime, DateTime.UtcNow);

        var sort = Builders<CampEvent>.Sort.Descending(e => e.StartTime);
        var list = await _db.Events.Find(filter).Sort(sort)
            .Skip((q.Page - 1) * q.PageSize).Limit(q.PageSize).ToListAsync();

        var dtos = await EnrichEventDtos(list);
        return Ok(ApiResponse<List<EventDto>>.Ok(dtos));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<EventDto>>> Get(string id)
    {
        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse<EventDto>.Fail("活动不存在"));
        var dtos = await EnrichEventDtos(new[] { ev });
        return Ok(ApiResponse<EventDto>.Ok(dtos[0]));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<EventDto>>> Create([FromBody] EventCreateDto req)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse<EventDto>.Fail("参数校验失败"));

        var uid = CurrentUserId;
        if (string.IsNullOrEmpty(uid)) return Unauthorized();

        var start = req.StartTime.Kind == DateTimeKind.Utc ? req.StartTime
            : DateTime.SpecifyKind(req.StartTime, DateTimeKind.Utc);
        var end = req.EndTime.Kind == DateTimeKind.Utc ? req.EndTime
            : DateTime.SpecifyKind(req.EndTime, DateTimeKind.Utc);
        if (end < start)
            return BadRequest(ApiResponse<EventDto>.Fail("结束时间需晚于开始时间"));

        var ev = new CampEvent
        {
            CreatorId = uid,
            Title = req.Title,
            Destination = req.Destination,
            GeoLocation = req.GeoLocation,
            StartTime = start,
            EndTime = end,
            MaxParticipants = Math.Max(2, req.MaxParticipants),
            Status = EventStatus.Planning,
            Description = req.Description ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        var participants = new List<Participant>
        {
            new() { UserId = uid, Role = "组织者", Confirmed = true }
        };
        if (req.Participants != null)
        {
            var roles = new[] { "厨师", "司机", "摄影", "医疗", "采购员" };
            foreach (var p in req.Participants)
            {
                if (p.UserId == uid) continue;
                participants.Add(new Participant
                {
                    UserId = p.UserId,
                    Role = roles.Contains(p.Role) ? p.Role : "参与者",
                    Confirmed = false
                });
            }
        }
        ev.Participants = participants;

        var reco = await _reco.RecommendGearForEvent(
            uid, req.Destination, start, ev.Participants.Count, req.Title);
        ev.GearList = reco.GearList.Select(g => new EventGear
        {
            Name = g.Name, Category = g.Category,
            Quantity = g.Quantity, Checked = false
        }).ToList();
        ev.PurchaseList = reco.PurchaseList.Select(p => new PurchaseItem
        {
            Name = p.Name, Category = p.Category,
            Quantity = p.Quantity, Unit = p.Unit
        }).ToList();

        await _db.Events.InsertOneAsync(ev);
        var dtos = await EnrichEventDtos(new[] { ev });
        return CreatedAtAction(nameof(Get), new { id = ev.Id },
            ApiResponse<EventDto>.Ok(dtos[0], "活动已创建，已为您推荐装备清单"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<EventDto>>> Update(
        string id, [FromBody] EventUpdateDto req)
    {
        var uid = CurrentUserId;
        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse<EventDto>.Fail("不存在"));
        if (ev.CreatorId != uid) return Forbid();

        var forceLww = req.ForceLastWriteWins;
        if (!forceLww && ev.Version != req.Version)
            return StatusCode(409, ApiResponse<EventDto>.Fail("内容已被他人修改，请刷新重试"));

        var ub = Builders<CampEvent>.Update;
        var list = new List<UpdateDefinition<CampEvent>>();

        if (!string.IsNullOrEmpty(req.Title)) list.Add(ub.Set(e => e.Title, req.Title));
        if (!string.IsNullOrEmpty(req.Destination)) list.Add(ub.Set(e => e.Destination, req.Destination));
        if (req.GeoLocation != null) list.Add(ub.Set(e => e.GeoLocation, req.GeoLocation));
        if (req.StartTime.HasValue)
        {
            var st = req.StartTime.Value.Kind == DateTimeKind.Utc ? req.StartTime.Value
                : DateTime.SpecifyKind(req.StartTime.Value, DateTimeKind.Utc);
            list.Add(ub.Set(e => e.StartTime, st));
        }
        if (req.EndTime.HasValue)
        {
            var et = req.EndTime.Value.Kind == DateTimeKind.Utc ? req.EndTime.Value
                : DateTime.SpecifyKind(req.EndTime.Value, DateTimeKind.Utc);
            list.Add(ub.Set(e => e.EndTime, et));
        }
        if (req.MaxParticipants.HasValue)
            list.Add(ub.Set(e => e.MaxParticipants, Math.Max(2, req.MaxParticipants.Value)));
        if (req.Description != null) list.Add(ub.Set(e => e.Description, req.Description));
        if (!string.IsNullOrEmpty(req.Status) &&
            new[] { EventStatus.Planning, EventStatus.Ongoing, EventStatus.Finished, EventStatus.Archived }
                .Contains(req.Status))
            list.Add(ub.Set(e => e.Status, req.Status));

        if (!list.Any())
        {
            var ds = await EnrichEventDtos(new[] { ev });
            return Ok(ApiResponse<EventDto>.Ok(ds[0]));
        }

        list.Add(ub.Inc(e => e.Version, 1));
        list.Add(ub.Set(e => e.UpdatedAt, DateTime.UtcNow));
        var combined = ub.Combine(list);

        FilterDefinition<CampEvent> filter = forceLww
            ? Builders<CampEvent>.Filter.Eq(e => e.Id, id)
            : Builders<CampEvent>.Filter.Eq(e => e.Id, id) & Builders<CampEvent>.Filter.Eq(e => e.Version, req.Version);

        var updated = await _db.Events.FindOneAndUpdateAsync(
            filter, combined,
            new FindOneAndUpdateOptions<CampEvent> { ReturnDocument = ReturnDocument.After });

        if (updated == null)
            return StatusCode(409, ApiResponse<EventDto>.Fail(forceLww
                ? "保存失败，请重试" : "并发冲突，请刷新"));

        var dtos = await EnrichEventDtos(new[] { updated });
        return Ok(ApiResponse<EventDto>.Ok(dtos[0], forceLww ? "已保存（冲突已按最后写入胜出处理）" : "已更新"));
    }

    [HttpGet("{id}/recommend")]
    public async Task<ActionResult<ApiResponse<RecommendResponseDto>>> Recommend(string id)
    {
        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse<RecommendResponseDto>.Fail("不存在"));

        var reco = await _reco.RecommendGearForEvent(
            ev.CreatorId, ev.Destination, ev.StartTime,
            Math.Max(ev.Participants.Count, 2), ev.Title);

        return Ok(ApiResponse<RecommendResponseDto>.Ok(reco));
    }

    [HttpPut("{id}/gearlist")]
    public async Task<ActionResult<ApiResponse>> UpdateGearList(
        string id, [FromBody] List<EventGearDto> gearList)
    {
        var uid = CurrentUserId;
        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse.Fail("不存在"));
        if (ev.CreatorId != uid &&
            !ev.Participants.Any(p => p.UserId == uid && p.Confirmed))
            return Forbid();

        var mapped = gearList.Select(g => new EventGear
        {
            Key = string.IsNullOrEmpty(g.Key) ? Guid.NewGuid().ToString("N") : g.Key,
            GearId = g.GearId, Name = g.Name, Category = g.Category,
            Quantity = Math.Max(1, g.Quantity),
            BroughtByUserId = g.BroughtByUserId, Checked = g.Checked
        }).ToList();

        await _db.Events.UpdateOneAsync(e => e.Id == id,
            Builders<CampEvent>.Update.Set(e => e.GearList, mapped)
                .Set(e => e.UpdatedAt, DateTime.UtcNow)
                .Inc(e => e.Version, 1));
        return Ok(ApiResponse.Ok("装备清单已更新"));
    }

    [HttpPut("{id}/purchaselist")]
    public async Task<ActionResult<ApiResponse>> UpdatePurchaseList(
        string id, [FromBody] List<PurchaseItemDto> purchaseList)
    {
        var uid = CurrentUserId;
        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse.Fail("不存在"));
        if (ev.CreatorId != uid &&
            !ev.Participants.Any(p => p.UserId == uid && p.Confirmed))
            return Forbid();

        var mapped = purchaseList.Select(p => new PurchaseItem
        {
            Key = string.IsNullOrEmpty(p.Key) ? Guid.NewGuid().ToString("N") : p.Key,
            Name = p.Name, Category = p.Category,
            Quantity = Math.Max(1, p.Quantity), Unit = p.Unit,
            AssignedToUserId = p.AssignedToUserId, Purchased = p.Purchased
        }).ToList();

        await _db.Events.UpdateOneAsync(e => e.Id == id,
            Builders<CampEvent>.Update.Set(e => e.PurchaseList, mapped)
                .Set(e => e.UpdatedAt, DateTime.UtcNow)
                .Inc(e => e.Version, 1));
        return Ok(ApiResponse.Ok("采购清单已更新"));
    }

    [HttpPost("{id}/join")]
    public async Task<ActionResult<ApiResponse>> Join(string id, [FromQuery] string role = "参与者")
    {
        var uid = CurrentUserId;
        if (string.IsNullOrEmpty(uid)) return Unauthorized();

        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse.Fail("不存在"));
        if (ev.Participants.Count >= ev.MaxParticipants)
            return BadRequest(ApiResponse.Fail("活动名额已满"));
        if (ev.Participants.Any(p => p.UserId == uid))
            return BadRequest(ApiResponse.Fail("你已报名此活动"));

        var validRoles = new[] { "厨师", "司机", "摄影", "医疗", "采购员", "参与者" };
        var finalRole = validRoles.Contains(role) ? role : "参与者";

        await _db.Events.UpdateOneAsync(e => e.Id == id,
            Builders<CampEvent>.Update.Push(e => e.Participants,
                new Participant { UserId = uid, Role = finalRole, Confirmed = false }));
        return Ok(ApiResponse.Ok("报名成功"));
    }

    [HttpPost("{id}/rate")]
    public async Task<ActionResult<ApiResponse<Rating>>> Rate(
        string id, [FromBody] EventRateDto req)
    {
        var uid = CurrentUserId;
        if (string.IsNullOrEmpty(uid)) return Unauthorized();

        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound(ApiResponse<Rating>.Fail("活动不存在"));
        if (!ev.Participants.Any(p => p.UserId == uid))
            return BadRequest(ApiResponse<Rating>.Fail("只有参与过的活动才能评价"));

        var tag = string.IsNullOrEmpty(req.DestinationTag)
            ? ev.Destination : req.DestinationTag;
        var season = req.Season > 0 ? req.Season : ev.StartTime.Month;

        var rating = new Rating
        {
            EventId = id, UserId = uid,
            TransportationScore = req.TransportationScore,
            SceneryScore = req.SceneryScore,
            FacilityScore = req.FacilityScore,
            SafetyScore = req.SafetyScore,
            Season = season, DestinationTag = tag,
            Comments = req.Comments ?? string.Empty
        };

        await _db.Ratings.FindOneAndReplaceAsync(
            r => r.EventId == id && r.UserId == uid,
            rating,
            new FindOneAndReplaceOptions<Rating> { IsUpsert = true });

        return Ok(ApiResponse<Rating>.Ok(rating, "评价已保存"));
    }

    [HttpGet("{id}/ratings")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<RatingDto>>>> Ratings(string id)
    {
        var list = await _db.Ratings
            .Find(r => r.EventId == id)
            .ToListAsync();

        var userIds = list.Select(r => r.UserId).Distinct().ToList();
        var users = (await _db.Users.Find(u => userIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id, JwtService.MapToUserDto);

        var dtos = list.Select(r => new RatingDto
        {
            UserId = r.UserId,
            User = users.GetValueOrDefault(r.UserId),
            TransportationScore = r.TransportationScore,
            SceneryScore = r.SceneryScore,
            FacilityScore = r.FacilityScore,
            SafetyScore = r.SafetyScore,
            Comments = r.Comments
        }).ToList();

        return Ok(ApiResponse<List<RatingDto>>.Ok(dtos));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        var uid = CurrentUserId;
        var ev = await _db.Events.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (ev == null) return NotFound();
        if (ev.CreatorId != uid) return Forbid();
        if (ev.Status == EventStatus.Ongoing)
            return BadRequest(ApiResponse.Fail("进行中的活动不能删除"));

        await _db.Events.DeleteOneAsync(e => e.Id == id);
        return Ok(ApiResponse.Ok("已删除"));
    }

    private async Task<List<EventDto>> EnrichEventDtos(IEnumerable<CampEvent> events)
    {
        var userIds = new HashSet<string>();
        foreach (var ev in events)
        {
            userIds.Add(ev.CreatorId);
            foreach (var p in ev.Participants) userIds.Add(p.UserId);
            foreach (var g in ev.GearList)
                if (!string.IsNullOrEmpty(g.BroughtByUserId))
                    userIds.Add(g.BroughtByUserId);
        }
        var userMap = (await _db.Users.Find(u => userIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id, JwtService.MapToUserDto);

        var result = new List<EventDto>();
        foreach (var ev in events)
        {
            userMap.TryGetValue(ev.CreatorId, out var creator);
            result.Add(new EventDto
            {
                Id = ev.Id,
                CreatorId = ev.CreatorId,
                Creator = creator,
                Title = ev.Title,
                Destination = ev.Destination,
                GeoLocation = ev.GeoLocation,
                StartTime = ev.StartTime,
                EndTime = ev.EndTime,
                MaxParticipants = ev.MaxParticipants,
                Status = ev.Status,
                Description = ev.Description,
                CoverImage = ev.CoverImage,
                Participants = ev.Participants.Select(p => new ParticipantDto
                {
                    UserId = p.UserId,
                    User = userMap.GetValueOrDefault(p.UserId),
                    Role = p.Role,
                    Confirmed = p.Confirmed
                }).ToList(),
                GearList = ev.GearList.Select(g => new EventGearDto
                {
                    Key = g.Key,
                    GearId = g.GearId,
                    Name = g.Name, Category = g.Category,
                    Quantity = g.Quantity,
                    BroughtByUserId = g.BroughtByUserId,
                    BroughtByUser = !string.IsNullOrEmpty(g.BroughtByUserId)
                        ? userMap.GetValueOrDefault(g.BroughtByUserId) : null,
                    Checked = g.Checked
                }).ToList(),
                PurchaseList = ev.PurchaseList.Select(p => new PurchaseItemDto
                {
                    Key = p.Key,
                    Name = p.Name, Category = p.Category,
                    Quantity = p.Quantity, Unit = p.Unit,
                    AssignedToUserId = p.AssignedToUserId,
                    Purchased = p.Purchased
                }).ToList(),
                Version = ev.Version,
                CreatedAt = ev.CreatedAt,
                UpdatedAt = ev.UpdatedAt
            });
        }
        return result;
    }
}

[Route("Event")]
public class EventMvcController : Controller
{
    public IActionResult Index() => User.Identity?.IsAuthenticated != true
        ? Redirect("/Account/Login?returnUrl=/Event")
        : View("~/Views/Event/Index.cshtml");

    public IActionResult Create() => User.Identity?.IsAuthenticated != true
        ? Redirect("/Account/Login?returnUrl=/Event/Create")
        : View("~/Views/Event/Create.cshtml");

    public IActionResult Details(string id)
    {
        if (User.Identity?.IsAuthenticated != true)
            return Redirect($"/Account/Login?returnUrl=/Event/Details/{id}");
        ViewData["EventId"] = id;
        return View("~/Views/Event/Details.cshtml");
    }
}

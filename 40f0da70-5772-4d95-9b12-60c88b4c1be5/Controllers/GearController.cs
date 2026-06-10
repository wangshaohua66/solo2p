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
public class GearController : ControllerBase
{
    private readonly MongoContext _db;
    private readonly RecommendationService _reco;

    public GearController(MongoContext db, RecommendationService reco)
    {
        _db = db;
        _reco = reco;
    }

    private string CurrentUserId => JwtService.GetUserIdFromClaims(User) ?? "";

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<GearDto>>>> List(
        [FromQuery] GearQueryDto q)
    {
        var fb = Builders<Gear>.Filter;
        var filter = fb.Empty;

        if (!string.IsNullOrEmpty(q.Status))
            filter &= fb.Eq(g => g.Status, q.Status);
        if (!string.IsNullOrEmpty(q.Category))
            filter &= fb.Eq(g => g.Category, q.Category);
        if (!string.IsNullOrEmpty(q.OwnerId))
            filter &= fb.Eq(g => g.OwnerId, q.OwnerId);

        if (!string.IsNullOrEmpty(q.Keyword))
        {
            var kw = q.Keyword.Trim();
            var kwLower = kw.ToLowerInvariant();
            filter &= fb.Or(
                fb.Text(kw),
                fb.Regex(g => g.Name,
                    new MongoDB.Bson.BsonRegularExpression("^" +
                        System.Text.RegularExpressions.Regex.Escape(kwLower), "i"))
            );
        }

        var sort = Builders<Gear>.Sort
            .Descending(g => g.CreatedAt);

        var list = await _db.Gears
            .Find(filter)
            .Sort(sort)
            .Skip((q.Page - 1) * q.PageSize)
            .Limit(q.PageSize)
            .ToListAsync();

        var ownerIds = list.Select(g => g.OwnerId)
            .Concat(list.Where(g => g.CurrentBorrowerId != null)
                .Select(g => g.CurrentBorrowerId!))
            .Distinct().ToList();

        var userMap = await BuildUserMap(ownerIds);

        var dtos = list.Select(g => MapGearDto(g, userMap)).ToList();
        return Ok(ApiResponse<List<GearDto>>.Ok(dtos));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<GearDto>>> Get(string id)
    {
        var g = await _db.Gears.Find(x => x.Id == id).FirstOrDefaultAsync();
        if (g == null) return NotFound(ApiResponse<GearDto>.Fail("装备不存在"));

        var ids = new List<string> { g.OwnerId };
        if (g.CurrentBorrowerId != null) ids.Add(g.CurrentBorrowerId);
        var map = await BuildUserMap(ids);

        return Ok(ApiResponse<GearDto>.Ok(MapGearDto(g, map)));
    }

    [HttpGet("{id}/borrow-records")]
    public async Task<ActionResult<ApiResponse<List<object>>>> BorrowRecords(string id, [FromQuery] int limit = 20)
    {
        var gear = await _db.Gears.Find(g => g.Id == id).FirstOrDefaultAsync();
        if (gear == null) return NotFound(ApiResponse<List<object>>.Fail("装备不存在"));

        var uid = CurrentUserId;
        if (gear.OwnerId != uid && gear.CurrentBorrowerId != uid)
            return Forbid();

        var records = await _db.BorrowRecords
            .Find(b => b.GearId == id)
            .SortByDescending(b => b.BorrowDate)
            .Limit(limit)
            .ToListAsync();

        var userIds = records.Select(r => r.BorrowerId).Distinct().ToList();
        var userMap = await BuildUserMap(userIds);

        var result = records.Select(r => new
        {
            r.Id,
            r.GearId,
            r.LenderId,
            r.BorrowerId,
            Borrower = userMap.GetValueOrDefault(r.BorrowerId),
            r.BorrowDate,
            r.DueDate,
            r.ActualReturnDate,
            r.ReturnCondition,
            r.CreditChange,
            r.Notes
        }).Cast<object>().ToList();

        return Ok(ApiResponse<List<object>>.Ok(result));
    }

    [HttpPost]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<GearDto>>> Create(
        [FromForm] GearCreateDto req, IFormFile? image)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse<GearDto>.Fail("参数校验失败"));

        var uid = CurrentUserId;
        if (string.IsNullOrEmpty(uid)) return Unauthorized();

        var gear = new Gear
        {
            OwnerId = uid,
            Name = req.Name,
            Category = GearCategories.All.Contains(req.Category) ? req.Category : "其他",
            Description = req.Description ?? string.Empty,
            PurchasePrice = req.PurchasePrice,
            Status = GearStatus.Available,
            UsageCount = 0,
            WearLevel = 0,
            NextMaintenanceAfterUses = Math.Max(1, req.NextMaintenanceAfterUses),
            CreatedAt = DateTime.UtcNow
        };

        if (image != null && image.Length > 0)
        {
            gear.ImageUrl = await SaveGearImage(image, gear.Id);
        }

        await _db.Gears.InsertOneAsync(gear);
        var map = await BuildUserMap(new[] { uid });
        return CreatedAtAction(nameof(Get), new { id = gear.Id },
            ApiResponse<GearDto>.Ok(MapGearDto(gear, map), "添加成功"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<GearDto>>> Update(
        string id, [FromBody] GearUpdateDto req)
    {
        var uid = CurrentUserId;
        var gear = await _db.Gears.Find(g => g.Id == id).FirstOrDefaultAsync();
        if (gear == null) return NotFound(ApiResponse<GearDto>.Fail("装备不存在"));
        if (gear.OwnerId != uid) return Forbid();

        var forceLww = req.ForceLastWriteWins;
        if (!forceLww && gear.Version != req.Version)
            return StatusCode(409, ApiResponse<GearDto>.Fail("内容已被他人修改，请刷新重试"));

        var ub = Builders<Gear>.Update;
        var updates = new List<UpdateDefinition<Gear>>();

        if (!string.IsNullOrEmpty(req.Name)) updates.Add(ub.Set(g => g.Name, req.Name));
        if (!string.IsNullOrEmpty(req.Category) && GearCategories.All.Contains(req.Category))
            updates.Add(ub.Set(g => g.Category, req.Category));
        if (req.Description != null) updates.Add(ub.Set(g => g.Description, req.Description));
        if (!string.IsNullOrEmpty(req.Status) &&
            new[] { GearStatus.Available, GearStatus.Repair, GearStatus.Scrap }.Contains(req.Status))
        {
            if (req.Status != GearStatus.Available && gear.Status == GearStatus.Lent)
                return BadRequest(ApiResponse<GearDto>.Fail("借出中的装备不能直接变更状态，请先确认归还"));
            updates.Add(ub.Set(g => g.Status, req.Status));
            if (req.Status == GearStatus.Scrap)
                updates.Add(ub.Set(g => g.CurrentBorrowerId, (string?)null)
                    .Set(g => g.DueDate, (DateTime?)null));
        }
        if (req.NextMaintenanceAfterUses.HasValue)
            updates.Add(ub.Set(g => g.NextMaintenanceAfterUses,
                Math.Max(1, req.NextMaintenanceAfterUses.Value)));

        if (!updates.Any()) return Ok(ApiResponse<GearDto>.Ok(MapGearDto(gear, await BuildUserMap(new[] { uid }))));

        updates.Add(ub.Inc(g => g.Version, 1));
        updates.Add(ub.Set(g => g.UpdatedAt, DateTime.UtcNow));
        var combined = ub.Combine(updates);

        FilterDefinition<Gear> filter = forceLww
            ? Builders<Gear>.Filter.Eq(g => g.Id, id)
            : Builders<Gear>.Filter.Eq(g => g.Id, id) & Builders<Gear>.Filter.Eq(g => g.Version, req.Version);

        var updated = await _db.Gears.FindOneAndUpdateAsync(
            filter, combined,
            new FindOneAndUpdateOptions<Gear> { ReturnDocument = ReturnDocument.After });

        if (updated == null)
            return StatusCode(409, ApiResponse<GearDto>.Fail(forceLww
                ? "保存失败，请重试" : "并发冲突，请刷新"));

        return Ok(ApiResponse<GearDto>.Ok(MapGearDto(updated!,
            await BuildUserMap(new[] { updated!.OwnerId, updated.CurrentBorrowerId ?? "" }
                .Where(s => !string.IsNullOrEmpty(s)).ToList())),
            forceLww ? "已保存（冲突已按最后写入胜出处理）" : "更新成功"));
    }

    [HttpPost("{id}/maintenance")]
    public async Task<ActionResult<ApiResponse<GearDto>>> RecordMaintenance(string id)
    {
        var uid = CurrentUserId;
        var gear = await _db.Gears.Find(g => g.Id == id).FirstOrDefaultAsync();
        if (gear == null) return NotFound(ApiResponse<GearDto>.Fail("装备不存在"));
        if (gear.OwnerId != uid) return Forbid();

        var update = Builders<Gear>.Update
            .Set(g => g.LastMaintenanceDate, DateTime.UtcNow)
            .Set(g => g.LastMaintenanceUsageCount, gear.UsageCount)
            .Set(g => g.UpdatedAt, DateTime.UtcNow)
            .Inc(g => g.Version, 1);

        var updated = await _db.Gears.FindOneAndUpdateAsync(
            g => g.Id == id, update,
            new FindOneAndUpdateOptions<Gear> { ReturnDocument = ReturnDocument.After });

        return Ok(ApiResponse<GearDto>.Ok(MapGearDto(updated!,
            await BuildUserMap(new[] { updated!.OwnerId }.ToList())), "保养已记录"));
    }

    [HttpPost("{id}/lend")]
    public async Task<ActionResult<ApiResponse<BorrowRecord>>> Lend(
        string id, [FromBody] GearLendDto req)
    {
        var uid = CurrentUserId;
        var gear = await _db.Gears.Find(g => g.Id == id).FirstOrDefaultAsync();
        if (gear == null) return NotFound(ApiResponse<BorrowRecord>.Fail("装备不存在"));
        if (gear.OwnerId != uid) return Forbid();
        if (gear.Status != GearStatus.Available)
            return BadRequest(ApiResponse<BorrowRecord>.Fail($"当前状态「{gear.Status}」不可借出"));
        if (req.BorrowerId == uid)
            return BadRequest(ApiResponse<BorrowRecord>.Fail("不能借给自己"));

        var borrower = await _db.Users.Find(u => u.Id == req.BorrowerId).FirstOrDefaultAsync();
        if (borrower == null)
            return BadRequest(ApiResponse<BorrowRecord>.Fail("借用人不存在"));

        if (borrower.CreditScore < 60)
            return BadRequest(ApiResponse<BorrowRecord>.Fail(
                $"借用人信用分不足（当前{borrower.CreditScore}分，低于60分失去借出优先权）"));

        using var session = await _db.Database.Client.StartSessionAsync();
        session.StartTransaction();

        try
        {
            var dueDateUtc = req.DueDate.Kind == DateTimeKind.Utc
                ? req.DueDate : DateTime.SpecifyKind(req.DueDate, DateTimeKind.Utc);

            var record = new BorrowRecord
            {
                GearId = id,
                LenderId = uid,
                BorrowerId = req.BorrowerId,
                BorrowDate = DateTime.UtcNow,
                DueDate = dueDateUtc,
                Notes = req.Notes ?? string.Empty
            };
            await _db.BorrowRecords.InsertOneAsync(session, record);

            await _db.Gears.UpdateOneAsync(session, g => g.Id == id,
                Builders<Gear>.Update
                    .Set(g => g.Status, GearStatus.Lent)
                    .Set(g => g.CurrentBorrowerId, req.BorrowerId)
                    .Set(g => g.DueDate, dueDateUtc)
                    .Set(g => g.UpdatedAt, DateTime.UtcNow)
                    .Inc(g => g.Version, 1));

            await session.CommitTransactionAsync();
            return Ok(ApiResponse<BorrowRecord>.Ok(record, "已借出"));
        }
        catch
        {
            await session.AbortTransactionAsync();
            throw;
        }
    }

    [HttpPost("{id}/return")]
    public async Task<ActionResult<ApiResponse<BorrowRecord>>> Return(
        string id, [FromBody] GearReturnDto req)
    {
        var uid = CurrentUserId;
        var gear = await _db.Gears.Find(g => g.Id == id).FirstOrDefaultAsync();
        if (gear == null) return NotFound(ApiResponse<BorrowRecord>.Fail("装备不存在"));

        if (gear.Status != GearStatus.Lent ||
            (gear.OwnerId != uid && gear.CurrentBorrowerId != uid))
            return Forbid();

        var record = await _db.BorrowRecords
            .Find(b => b.GearId == id && b.ActualReturnDate == null)
            .SortByDescending(b => b.BorrowDate)
            .FirstOrDefaultAsync();

        if (record == null)
            return BadRequest(ApiResponse<BorrowRecord>.Fail("无未归还记录"));

        using var session = await _db.Database.Client.StartSessionAsync();
        session.StartTransaction();

        try
        {
            var now = DateTime.UtcNow;
            record.ActualReturnDate = now;
            record.ReturnCondition = req.Condition;

            int creditDelta = 0;
            string creditReason = "按时归还";
            if (now > record.DueDate)
            {
                var daysLate = (int)Math.Ceiling((now - record.DueDate).TotalDays);
                creditDelta = -daysLate * 2;
                creditReason = $"逾期{daysLate}天归还";
            }
            else
            {
                creditDelta = 5;
            }

            if (req.Condition == "报废" || req.Condition == "丢失")
            {
                creditDelta -= 20;
                creditReason += $" + {req.Condition}赔偿";
            }

            record.CreditChange = creditDelta;

            var log = new CreditLog
            {
                UserId = record.BorrowerId,
                Delta = creditDelta,
                Reason = creditReason,
                CreatedAt = now
            };
            await _db.CreditLogs.InsertOneAsync(session, log);
            await _db.BorrowRecords.ReplaceOneAsync(session, b => b.Id == record.Id, record);

            var borrowerUpdate = Builders<User>.Update.Inc(u => u.CreditScore, creditDelta);
            await _db.Users.UpdateOneAsync(session, u => u.Id == record.BorrowerId, borrowerUpdate);

            var wearUpdate = Builders<Gear>.Update
                .Set(g => g.Status, req.Condition == "报废" ? GearStatus.Scrap : GearStatus.Available)
                .Set(g => g.CurrentBorrowerId, (string?)null)
                .Set(g => g.DueDate, (DateTime?)null)
                .Set(g => g.UpdatedAt, now)
                .Inc(g => g.UsageCount, 1)
                .Inc(g => g.Version, 1);
            if (req.NewWearLevel.HasValue)
                wearUpdate = wearUpdate.Set(g => g.WearLevel,
                    Math.Clamp(req.NewWearLevel.Value, 0, 100));
            await _db.Gears.UpdateOneAsync(session, g => g.Id == id, wearUpdate);

            await session.CommitTransactionAsync();
            return Ok(ApiResponse<BorrowRecord>.Ok(record,
                $"已归还，信用分{creditDelta:+#;-#;0}（{creditReason}）"));
        }
        catch
        {
            await session.AbortTransactionAsync();
            throw;
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        var uid = CurrentUserId;
        var gear = await _db.Gears.Find(g => g.Id == id).FirstOrDefaultAsync();
        if (gear == null) return NotFound(ApiResponse.Fail("不存在"));
        if (gear.OwnerId != uid) return Forbid();
        if (gear.Status == GearStatus.Lent)
            return BadRequest(ApiResponse.Fail("借出中不能删除，请先处理归还"));

        var result = await _db.Gears.DeleteOneAsync(g => g.Id == id);
        if (result.DeletedCount == 0) return NotFound(ApiResponse.Fail("删除失败"));
        return Ok(ApiResponse.Ok("已删除"));
    }

    [HttpGet("recommend/combo")]
    public async Task<ActionResult<ApiResponse<List<GearDto>>>> RecommendCombo(
        [FromQuery] int participants = 4, [FromQuery] string category = "")
    {
        var uid = CurrentUserId;
        var all = await _db.Gears
            .Find(g => g.OwnerId == uid || g.Status == GearStatus.Available)
            .ToListAsync();
        var recommended = _reco.RecommendGearCombination(all, participants, category);
        var ids = recommended.Select(g => g.OwnerId).Distinct().ToList();
        var map = await BuildUserMap(ids);
        var dtos = recommended.Select(g => MapGearDto(g, map)).ToList();
        return Ok(ApiResponse<List<GearDto>>.Ok(dtos));
    }

    [HttpGet("scan-overdue")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<int>>> DailyScanOverdue()
    {
        var now = DateTime.UtcNow;
        var overdueGears = await _db.Gears
            .Find(g => g.Status == GearStatus.Lent && g.DueDate < now)
            .ToListAsync();
        return Ok(ApiResponse<int>.Ok(overdueGears.Count,
            $"发现{overdueGears.Count}件逾期装备"));
    }

    private async Task<Dictionary<string, UserDto>> BuildUserMap(IEnumerable<string> ids)
    {
        var distinct = ids.Where(s => !string.IsNullOrEmpty(s)).Distinct().ToList();
        if (!distinct.Any()) return new Dictionary<string, UserDto>();

        var users = await _db.Users
            .Find(u => distinct.Contains(u.Id))
            .ToListAsync();
        return users.ToDictionary(u => u.Id, JwtService.MapToUserDto);
    }

    private static GearDto MapGearDto(Gear g, Dictionary<string, UserDto> userMap)
    {
        userMap.TryGetValue(g.OwnerId, out var owner);
        UserDto? borrower = null;
        if (g.CurrentBorrowerId != null)
            userMap.TryGetValue(g.CurrentBorrowerId, out borrower);

        return new GearDto
        {
            Id = g.Id,
            OwnerId = g.OwnerId,
            Owner = owner,
            Name = g.Name,
            Category = g.Category,
            Description = g.Description,
            ImageUrl = g.ImageUrl,
            Status = g.Status,
            PurchasePrice = g.PurchasePrice,
            UsageCount = g.UsageCount,
            WearLevel = g.WearLevel,
            LastMaintenanceDate = g.LastMaintenanceDate,
            NextMaintenanceAfterUses = g.NextMaintenanceAfterUses,
            CurrentBorrowerId = g.CurrentBorrowerId,
            CurrentBorrower = borrower,
            DueDate = g.DueDate,
            NeedsMaintenance = g.NeedsMaintenance,
            UsesSinceMaintenance = g.UsesSinceMaintenance,
            Version = g.Version,
            UpdatedAt = g.UpdatedAt
        };
    }

    private static async Task<string> SaveGearImage(IFormFile file, string gearId)
    {
        var dir = Path.Combine("wwwroot", "uploads", "photos", "gear");
        Directory.CreateDirectory(dir);
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var filename = $"{gearId}_{Guid.NewGuid():N}{ext}";
        var path = Path.Combine(dir, filename);
        await using var fs = new FileStream(path, FileMode.Create);
        await file.CopyToAsync(fs);
        return $"/uploads/photos/gear/{filename}";
    }
}

[Route("Gear")]
public class GearMvcController : Controller
{
    public IActionResult Index() => User.Identity?.IsAuthenticated != true
        ? Redirect("/Account/Login?returnUrl=/Gear")
        : View("~/Views/Gear/Index.cshtml");

    public IActionResult Create() => User.Identity?.IsAuthenticated != true
        ? Redirect("/Account/Login?returnUrl=/Gear/Create")
        : View("~/Views/Gear/Create.cshtml");

    public IActionResult Details(string id)
    {
        if (User.Identity?.IsAuthenticated != true)
            return Redirect($"/Account/Login?returnUrl=/Gear/Details/{id}");
        ViewData["GearId"] = id;
        return View("~/Views/Gear/Details.cshtml");
    }
}

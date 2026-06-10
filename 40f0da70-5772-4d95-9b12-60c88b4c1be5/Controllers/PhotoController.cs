using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using CampHub.Models;
using CampHub.Services;

namespace CampHub.Controllers;

[Route("Photo")]
public class PhotoMvcController : Controller
{
    public IActionResult Index() => User.Identity?.IsAuthenticated != true
        ? Redirect("/Account/Login?returnUrl=/Photo")
        : View("~/Views/Photo/Index.cshtml");
}

[Route("api/[controller]")]
[ApiController]
[Authorize]
[Produces("application/json")]
public class PhotoController : ControllerBase
{
    private readonly MongoContext _db;
    private readonly PhotoSettings _opt;
    private readonly ExifService _exif;

    public PhotoController(MongoContext db, IOptions<PhotoSettings> opt, ExifService exif)
    {
        _db = db;
        _opt = opt.Value;
        _exif = exif;
    }

    private string CurrentUserId => JwtService.GetUserIdFromClaims(User) ?? "";

    [HttpPost("upload")]
    [RequestSizeLimit(100 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<List<PhotoUploadResponseDto>>>> Upload(
        IFormFileCollection files, [FromForm] string? eventId,
        [FromForm] string? caption)
    {
        var uid = CurrentUserId;
        if (string.IsNullOrEmpty(uid)) return Unauthorized();
        if (files == null || files.Count == 0)
            return BadRequest(ApiResponse<List<PhotoUploadResponseDto>>.Fail("请选择文件"));

        var allowedExt = _opt.AllowedExtensions.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim().ToLowerInvariant()).ToHashSet();
        var maxSize = _opt.MaxFileSizeMB * 1024 * 1024;

        var uploadDir = Path.Combine(Directory.GetCurrentDirectory(),
            _opt.UploadPath, DateTime.UtcNow.ToString("yyyyMM"));
        Directory.CreateDirectory(uploadDir);

        var results = new List<PhotoUploadResponseDto>();

        foreach (var file in files)
        {
            if (file.Length == 0 || file.Length > maxSize) continue;
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExt.Contains(ext)) continue;

            var fileName = $"{Guid.NewGuid():N}{ext}";
            var filePath = Path.Combine(uploadDir, fileName);
            var relativeDir = $"/uploads/photos/{DateTime.UtcNow:yyyyMM}/";
            var fileUrl = relativeDir + fileName;

            await using (var fs = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fs);
            }

            (decimal? lat, decimal? lng, DateTime? takenAt) = (null, null, null);
            try
            {
                await using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                (lat, lng, takenAt) = _exif.ExtractMetadata(ms);
            }
            catch
            {
                // exif failure ignored
            }

            var photo = new Photo
            {
                EventId = string.IsNullOrEmpty(eventId) ? string.Empty : eventId,
                UploaderId = uid,
                FileUrl = fileUrl,
                ThumbUrl = fileUrl,
                GPS_Lat = lat,
                GPS_Lng = lng,
                TakenAt = takenAt ?? DateTime.UtcNow,
                UploadedAt = DateTime.UtcNow,
                Caption = caption ?? string.Empty
            };

            await _db.Photos.InsertOneAsync(photo);

            results.Add(new PhotoUploadResponseDto
            {
                Id = photo.Id,
                FileUrl = fileUrl,
                ThumbUrl = fileUrl,
                GPS_Lat = lat,
                GPS_Lng = lng,
                TakenAt = takenAt
            });
        }

        return Ok(ApiResponse<List<PhotoUploadResponseDto>>.Ok(results,
            $"成功上传{results.Count}张"));
    }

    [HttpGet("event/{eventId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<PhotoDto>>>> ByEvent(
        string eventId, [FromQuery] int limit = 200)
    {
        var list = await _db.Photos
            .Find(p => p.EventId == eventId)
            .SortBy(p => p.TakenAt)
            .Limit(limit)
            .ToListAsync();
        return Ok(ApiResponse<List<PhotoDto>>.Ok(await EnrichPhotos(list)));
    }

    [HttpGet("mine")]
    public async Task<ActionResult<ApiResponse<List<PhotoDto>>>> Mine(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var uid = CurrentUserId;
        var list = await _db.Photos
            .Find(p => p.UploaderId == uid)
            .SortByDescending(p => p.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();
        return Ok(ApiResponse<List<PhotoDto>>.Ok(await EnrichPhotos(list)));
    }

    [HttpGet("all")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<PhotoDto>>>> All(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 60,
        [FromQuery] string? eventIdFilter = null,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var fb = Builders<Photo>.Filter;
        var filter = fb.Empty;
        if (!string.IsNullOrEmpty(eventIdFilter))
            filter &= fb.Eq(p => p.EventId, eventIdFilter);
        if (from.HasValue)
            filter &= fb.Gte(p => p.TakenAt, from.Value);
        if (to.HasValue)
            filter &= fb.Lte(p => p.TakenAt, to.Value);

        var list = await _db.Photos
            .Find(filter)
            .SortByDescending(p => p.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return Ok(ApiResponse<List<PhotoDto>>.Ok(await EnrichPhotos(list)));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        var uid = CurrentUserId;
        var photo = await _db.Photos.Find(p => p.Id == id).FirstOrDefaultAsync();
        if (photo == null) return NotFound(ApiResponse.Fail("照片不存在"));
        if (photo.UploaderId != uid) return Forbid();

        await _db.Photos.DeleteOneAsync(p => p.Id == id);
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot",
            photo.FileUrl.TrimStart('/'));
        try { if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath); } catch { }

        return Ok(ApiResponse.Ok("已删除"));
    }

    [HttpGet("track/{eventId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<GpsTrackPoint>>>> Track(string eventId)
    {
        var points = await _db.Photos
            .Find(p => p.EventId == eventId
                && p.GPS_Lat.HasValue && p.GPS_Lng.HasValue
                && p.TakenAt.HasValue)
            .SortBy(p => p.TakenAt)
            .Project(p => new GpsTrackPoint
            {
                PhotoId = p.Id,
                Lat = p.GPS_Lat!.Value,
                Lng = p.GPS_Lng!.Value,
                TakenAt = p.TakenAt!.Value,
                ThumbUrl = p.ThumbUrl
            })
            .ToListAsync();
        return Ok(ApiResponse<List<GpsTrackPoint>>.Ok(points));
    }

    private async Task<List<PhotoDto>> EnrichPhotos(List<Photo> photos)
    {
        if (!photos.Any()) return new List<PhotoDto>();

        var uploaderIds = photos.Select(p => p.UploaderId).Distinct().ToList();
        var userMap = (await _db.Users.Find(u => uploaderIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id, JwtService.MapToUserDto);

        return photos.Select(p => new PhotoDto
        {
            Id = p.Id, EventId = p.EventId,
            UploaderId = p.UploaderId,
            Uploader = userMap.GetValueOrDefault(p.UploaderId),
            FileUrl = p.FileUrl, ThumbUrl = p.ThumbUrl,
            GPS_Lat = p.GPS_Lat, GPS_Lng = p.GPS_Lng,
            TakenAt = p.TakenAt, UploadedAt = p.UploadedAt,
            Caption = p.Caption
        }).ToList();
    }
}

public class GpsTrackPoint
{
    public string PhotoId { get; set; } = string.Empty;
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public DateTime TakenAt { get; set; }
    public string ThumbUrl { get; set; } = string.Empty;
}

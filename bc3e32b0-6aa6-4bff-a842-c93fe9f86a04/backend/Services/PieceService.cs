using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;
using PotteryStudio.Services;

namespace PotteryStudio.Services;

public class PieceService : IPieceService
{
    private readonly AppDbContext _context;

    public PieceService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<PieceArchive>> GetPiecesAsync(
        PagedQuery query, 
        Guid? memberId = null, 
        PieceStatus? status = null,
        PhotoStage? stage = null,
        string? search = null)
    {
        var queryable = _context.PieceArchives
            .Include(p => p.Photos)
            .AsQueryable();

        if (memberId.HasValue)
            queryable = queryable.Where(p => p.MemberId == memberId.Value);

        if (status.HasValue)
            queryable = queryable.Where(p => p.Status == status.Value);

        if (!string.IsNullOrEmpty(search))
        {
            var keyword = search.ToLower();
            queryable = queryable.Where(p => 
                p.Title.ToLower().Contains(keyword) ||
                p.Description.ToLower().Contains(keyword) ||
                p.MemberName.ToLower().Contains(keyword));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(p => p.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<PieceArchive?> GetPieceByIdAsync(Guid id)
    {
        return await _context.PieceArchives
            .Include(p => p.Photos)
            .Include(p => p.GlazeRecipe)
            .Include(p => p.KilnSchedule)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<PieceArchive> CreatePieceAsync(PieceArchive piece)
    {
        piece.Id = Guid.NewGuid();
        piece.CreatedAt = DateTime.UtcNow;
        piece.UpdatedAt = DateTime.UtcNow;
        piece.Status = PieceStatus.Clay;

        if (piece.Photos == null)
            piece.Photos = new List<PiecePhoto>();

        _context.PieceArchives.Add(piece);
        await _context.SaveChangesAsync();
        return piece;
    }

    public async Task<PieceArchive> UpdatePieceAsync(Guid id, PieceArchive piece)
    {
        var existing = await _context.PieceArchives.FindAsync(id)
            ?? throw new InvalidOperationException("作品不存在");

        existing.Title = piece.Title;
        existing.Description = piece.Description;
        existing.Weight = piece.Weight;
        existing.Height = piece.Height;
        existing.Width = piece.Width;
        existing.GlazeRecipeId = piece.GlazeRecipeId;
        existing.KilnScheduleId = piece.KilnScheduleId;
        existing.UpdatedAt = DateTime.UtcNow;

        if (piece.Tags != null)
            existing.Tags = piece.Tags;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeletePieceAsync(Guid id)
    {
        var piece = await _context.PieceArchives.FindAsync(id)
            ?? throw new InvalidOperationException("作品不存在");

        _context.PieceArchives.Remove(piece);
        await _context.SaveChangesAsync();
    }

    public async Task<PiecePhoto> AddPhotoAsync(Guid pieceId, PiecePhoto photo)
    {
        var piece = await _context.PieceArchives.FindAsync(pieceId)
            ?? throw new InvalidOperationException("作品不存在");

        photo.Id = Guid.NewGuid();
        photo.PieceId = pieceId;
        photo.UploadedAt = DateTime.UtcNow;

        _context.PiecePhotos.Add(photo);

        var currentStage = photo.Stage;
        if (currentStage == PhotoStage.Finished && piece.Status != PieceStatus.Completed)
        {
            piece.Status = PieceStatus.Completed;
            piece.CompletedAt = DateTime.UtcNow;
        }
        else if (currentStage == PhotoStage.Glaze && piece.Status < PieceStatus.Glazed)
        {
            piece.Status = PieceStatus.Glazed;
        }
        else if (currentStage == PhotoStage.Bisque && piece.Status < PieceStatus.Bisque)
        {
            piece.Status = PieceStatus.Bisque;
        }

        piece.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return photo;
    }

    public async Task<PiecePhoto> UpdatePhotoAsync(Guid photoId, PiecePhoto photo)
    {
        var existing = await _context.PiecePhotos.FindAsync(photoId)
            ?? throw new InvalidOperationException("照片不存在");

        existing.Stage = photo.Stage;
        existing.Description = photo.Description;
        existing.Url = photo.Url;
        existing.ThumbnailUrl = photo.ThumbnailUrl;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeletePhotoAsync(Guid photoId)
    {
        var photo = await _context.PiecePhotos.FindAsync(photoId)
            ?? throw new InvalidOperationException("照片不存在");

        _context.PiecePhotos.Remove(photo);
        await _context.SaveChangesAsync();
    }

    public async Task<List<PiecePhoto>> GetPiecePhotosAsync(Guid pieceId)
    {
        return await _context.PiecePhotos
            .Where(p => p.PieceId == pieceId)
            .OrderBy(p => p.Stage)
            .ThenBy(p => p.UploadedAt)
            .ToListAsync();
    }

    public async Task<PieceArchive> UpdateStatusAsync(Guid id, PieceStatus status)
    {
        var piece = await _context.PieceArchives.FindAsync(id)
            ?? throw new InvalidOperationException("作品不存在");

        piece.Status = status;
        piece.UpdatedAt = DateTime.UtcNow;

        if (status == PieceStatus.Completed)
            piece.CompletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return piece;
    }
}

using ElderlyCareSystem.Models;
using ElderlyCareSystem.Repositories;

namespace ElderlyCareSystem.Services;

public interface IElderlyService
{
    Task<List<ElderlyProfile>> GetAllAsync(string? facilityId = null);
    Task<ElderlyProfile?> GetByIdAsync(string id);
    Task<ElderlyProfile> CreateAsync(ElderlyProfile profile);
    Task UpdateAsync(string id, ElderlyProfile profile);
    Task DeleteAsync(string id);
    Task<List<ElderlyProfile>> SearchAsync(string keyword, string? facilityId = null);
    Task<ElderlyProfile?> GetByIdCardAsync(string idCardNumber);
    Task<bool> CheckInAsync(string elderlyId, string bedId, string operatorName);
    Task<bool> CheckOutAsync(string elderlyId, string operatorName, string? reason = null);
    Task<bool> AddAttachmentAsync(string elderlyId, Attachment attachment);
    Task<bool> DeleteAttachmentAsync(string elderlyId, string attachmentId);
    Task<bool> UpdateCareLevelAssessmentAsync(string elderlyId, CareLevelAssessment assessment);
    Task<long> CountAsync(string? facilityId = null, string? status = null);
}

public class ElderlyService : IElderlyService
{
    private readonly IElderlyRepository _elderlyRepository;
    private readonly IBedRepository _bedRepository;

    public ElderlyService(IElderlyRepository elderlyRepository, IBedRepository bedRepository)
    {
        _elderlyRepository = elderlyRepository;
        _bedRepository = bedRepository;
    }

    public async Task<List<ElderlyProfile>> GetAllAsync(string? facilityId = null)
    {
        return await _elderlyRepository.GetAllAsync(facilityId);
    }

    public async Task<ElderlyProfile?> GetByIdAsync(string id)
    {
        return await _elderlyRepository.GetByIdAsync(id);
    }

    public async Task<ElderlyProfile> CreateAsync(ElderlyProfile profile)
    {
        var existing = await _elderlyRepository.GetByIdCardAsync(profile.IdCardNumber);
        if (existing != null)
        {
            throw new InvalidOperationException($"身份证号 {profile.IdCardNumber} 已存在");
        }
        return await _elderlyRepository.CreateAsync(profile);
    }

    public async Task UpdateAsync(string id, ElderlyProfile profile)
    {
        var existing = await _elderlyRepository.GetByIdAsync(id);
        if (existing == null)
        {
            throw new KeyNotFoundException($"老人档案 {id} 不存在");
        }
        profile.Id = id;
        profile.CreatedAt = existing.CreatedAt;
        await _elderlyRepository.UpdateAsync(id, profile);
    }

    public async Task DeleteAsync(string id)
    {
        var profile = await _elderlyRepository.GetByIdAsync(id);
        if (profile == null)
        {
            throw new KeyNotFoundException($"老人档案 {id} 不存在");
        }

        if (!string.IsNullOrEmpty(profile.BedId))
        {
            var history = new BedHistory
            {
                Action = "Vacated",
                ElderlyId = profile.Id,
                ElderlyName = profile.Name,
                ActionDate = DateTime.UtcNow,
                Notes = "删除档案时自动退床"
            };
            await _bedRepository.UpdateBedStatusAsync(profile.BedId, "Available", history);
        }

        await _elderlyRepository.DeleteAsync(id);
    }

    public async Task<List<ElderlyProfile>> SearchAsync(string keyword, string? facilityId = null)
    {
        return await _elderlyRepository.SearchAsync(keyword, facilityId);
    }

    public async Task<ElderlyProfile?> GetByIdCardAsync(string idCardNumber)
    {
        return await _elderlyRepository.GetByIdCardAsync(idCardNumber);
    }

    public async Task<bool> CheckInAsync(string elderlyId, string bedId, string operatorName)
    {
        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人档案不存在");

        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        if (bed.Status != "Available") throw new InvalidOperationException($"床位当前状态为 {bed.Status}，无法入住");

        elderly.BedId = bedId;
        elderly.CheckInDate = DateTime.UtcNow;
        elderly.Status = "Active";
        await _elderlyRepository.UpdateAsync(elderlyId, elderly);

        bed.Status = "Occupied";
        bed.ElderlyId = elderlyId;
        bed.ElderlyName = elderly.Name;
        bed.OccupiedDate = DateTime.UtcNow;
        var history = new BedHistory
        {
            Action = "CheckedIn",
            ElderlyId = elderlyId,
            ElderlyName = elderly.Name,
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = $"入住 {bed.Building}-{bed.Floor}楼-{bed.RoomNumber}-{bed.BedNumber}"
        };
        bed.History.Add(history);
        await _bedRepository.UpdateAsync(bedId, bed);

        return true;
    }

    public async Task<bool> CheckOutAsync(string elderlyId, string operatorName, string? reason = null)
    {
        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人档案不存在");
        if (string.IsNullOrEmpty(elderly.BedId)) throw new InvalidOperationException("老人未入住任何床位");

        var bedId = elderly.BedId;
        var bed = await _bedRepository.GetByIdAsync(bedId);

        elderly.BedId = null;
        elderly.CheckOutDate = DateTime.UtcNow;
        elderly.Status = "CheckedOut";
        await _elderlyRepository.UpdateAsync(elderlyId, elderly);

        if (bed != null)
        {
            var history = new BedHistory
            {
                Action = "CheckedOut",
                ElderlyId = elderlyId,
                ElderlyName = elderly.Name,
                ActionDate = DateTime.UtcNow,
                OperatorName = operatorName,
                Notes = reason ?? "正常退床"
            };
            bed.Status = "Available";
            bed.ElderlyId = null;
            bed.ElderlyName = null;
            bed.ExpectedVacateDate = null;
            bed.History.Add(history);
            await _bedRepository.UpdateAsync(bedId, bed);
        }

        return true;
    }

    public async Task<bool> AddAttachmentAsync(string elderlyId, Attachment attachment)
    {
        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人档案不存在");

        attachment.AttachmentId = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
        attachment.UploadDate = DateTime.UtcNow;
        elderly.Attachments.Add(attachment);
        elderly.UpdatedAt = DateTime.UtcNow;
        await _elderlyRepository.UpdateAsync(elderlyId, elderly);
        return true;
    }

    public async Task<bool> DeleteAttachmentAsync(string elderlyId, string attachmentId)
    {
        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人档案不存在");

        var attachment = elderly.Attachments.FirstOrDefault(a => a.AttachmentId == attachmentId);
        if (attachment == null) throw new KeyNotFoundException("附件不存在");

        elderly.Attachments.Remove(attachment);
        elderly.UpdatedAt = DateTime.UtcNow;
        await _elderlyRepository.UpdateAsync(elderlyId, elderly);
        return true;
    }

    public async Task<bool> UpdateCareLevelAssessmentAsync(string elderlyId, CareLevelAssessment assessment)
    {
        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人档案不存在");

        assessment.AssessmentId = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
        assessment.AssessmentDate = DateTime.UtcNow;
        elderly.CareLevelAssessment = assessment;
        elderly.CareLevel = assessment.OverallLevel;
        elderly.UpdatedAt = DateTime.UtcNow;
        await _elderlyRepository.UpdateAsync(elderlyId, elderly);
        return true;
    }

    public async Task<long> CountAsync(string? facilityId = null, string? status = null)
    {
        return await _elderlyRepository.CountAsync(facilityId, status);
    }
}

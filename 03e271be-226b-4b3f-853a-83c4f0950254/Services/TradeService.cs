using Microsoft.EntityFrameworkCore;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Services;

public interface ITradeService
{
    Task<TradeOrderDto> CreateListingAsync(TradeOrderCreateDto dto, int userId);
    Task<TradeOrderDto> SubmitBidAsync(TradeOrderBidDto dto);
    Task<TradeOrderDto> ReviewAsync(TradeOrderReviewDto dto, int reviewerId);
    Task<TradeOrderDto> RecheckAsync(TradeOrderRecheckDto dto, int recheckerId);
    Task<TradeOrderDto> GetByIdAsync(int id);
    Task<PagedResult<TradeOrderDto>> QueryAsync(TradeOrderQueryDto query);
}

public class TradeService : ITradeService
{
    private readonly AppDbContext _dbContext;
    private const decimal PriceDeviationThreshold = 0.20m;

    public TradeService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TradeOrderDto> CreateListingAsync(TradeOrderCreateDto dto, int userId)
    {
        var miningRight = await _dbContext.MiningRights
            .FirstOrDefaultAsync(mr => mr.Id == dto.MiningRightId);

        if (miningRight == null)
        {
            throw new KeyNotFoundException($"采矿权ID {dto.MiningRightId} 不存在");
        }

        if (miningRight.Status != MiningRightStatus.Active)
        {
            throw new InvalidOperationException("只有有效状态的采矿权才能挂牌交易");
        }

        var activeTrade = await _dbContext.TradeOrders
            .AnyAsync(to => to.MiningRightId == dto.MiningRightId
                && (to.Status == TradeStatus.Listed || to.Status == TradeStatus.Bidding
                    || to.Status == TradeStatus.PendingReview));

        if (activeTrade)
        {
            throw new InvalidOperationException("该采矿权已有正在进行的交易");
        }

        var tradeOrder = new TradeOrder
        {
            MiningRightId = dto.MiningRightId,
            Transferor = dto.Transferor,
            AskingPrice = dto.AskingPrice,
            AppraisalPrice = dto.AppraisalPrice,
            Status = TradeStatus.Listed,
            ListedAt = DateTime.UtcNow,
            BidDeadline = dto.BidDeadline ?? DateTime.UtcNow.AddDays(30)
        };

        _dbContext.TradeOrders.Add(tradeOrder);
        await _dbContext.SaveChangesAsync();

        return await GetByIdAsync(tradeOrder.Id);
    }

    public async Task<TradeOrderDto> SubmitBidAsync(TradeOrderBidDto dto)
    {
        var tradeOrder = await _dbContext.TradeOrders.FindAsync(dto.TradeOrderId);
        if (tradeOrder == null)
        {
            throw new KeyNotFoundException($"交易订单ID {dto.TradeOrderId} 不存在");
        }

        if (tradeOrder.Status != TradeStatus.Listed && tradeOrder.Status != TradeStatus.Bidding)
        {
            throw new InvalidOperationException("当前状态不允许报价");
        }

        if (tradeOrder.BidDeadline.HasValue && tradeOrder.BidDeadline.Value < DateTime.UtcNow)
        {
            throw new InvalidOperationException("报价已截止");
        }

        if (dto.BidPrice < tradeOrder.AskingPrice)
        {
            throw new ArgumentException("报价不得低于挂牌价");
        }

        tradeOrder.Transferee = dto.Transferee;
        tradeOrder.BidPrice = dto.BidPrice;
        tradeOrder.Status = TradeStatus.PendingReview;

        if (tradeOrder.AppraisalPrice.HasValue)
        {
            var deviation = Math.Abs(dto.BidPrice - tradeOrder.AppraisalPrice.Value) / tradeOrder.AppraisalPrice.Value;
            if (deviation > PriceDeviationThreshold)
            {
                tradeOrder.NeedsRecheck = true;
            }
        }

        await _dbContext.SaveChangesAsync();
        return await GetByIdAsync(dto.TradeOrderId);
    }

    public async Task<TradeOrderDto> ReviewAsync(TradeOrderReviewDto dto, int reviewerId)
    {
        var tradeOrder = await _dbContext.TradeOrders.FindAsync(dto.TradeOrderId);
        if (tradeOrder == null)
        {
            throw new KeyNotFoundException($"交易订单ID {dto.TradeOrderId} 不存在");
        }

        if (tradeOrder.Status != TradeStatus.PendingReview)
        {
            throw new InvalidOperationException("当前状态不允许审核");
        }

        tradeOrder.ReviewerId = reviewerId;
        tradeOrder.ReviewedAt = DateTime.UtcNow;
        tradeOrder.ReviewOpinion = dto.ReviewOpinion;

        if (!dto.Approved)
        {
            tradeOrder.Status = TradeStatus.Rejected;
        }
        else if (tradeOrder.NeedsRecheck)
        {
            tradeOrder.Status = TradeStatus.PendingReview;
        }
        else
        {
            tradeOrder.Status = TradeStatus.Approved;
            await CompleteTradeAsync(tradeOrder);
        }

        await _dbContext.SaveChangesAsync();
        return await GetByIdAsync(dto.TradeOrderId);
    }

    public async Task<TradeOrderDto> RecheckAsync(TradeOrderRecheckDto dto, int recheckerId)
    {
        var tradeOrder = await _dbContext.TradeOrders.FindAsync(dto.TradeOrderId);
        if (tradeOrder == null)
        {
            throw new KeyNotFoundException($"交易订单ID {dto.TradeOrderId} 不存在");
        }

        if (!tradeOrder.NeedsRecheck)
        {
            throw new InvalidOperationException("该订单不需要复核");
        }

        if (tradeOrder.Status != TradeStatus.PendingReview || tradeOrder.ReviewedAt == null)
        {
            throw new InvalidOperationException("请先完成初审后再进行复核");
        }

        tradeOrder.RecheckerId = recheckerId;
        tradeOrder.RecheckedAt = DateTime.UtcNow;
        tradeOrder.RecheckOpinion = dto.RecheckOpinion;

        if (dto.Approved)
        {
            tradeOrder.Status = TradeStatus.Approved;
            await CompleteTradeAsync(tradeOrder);
        }
        else
        {
            tradeOrder.Status = TradeStatus.Rejected;
        }

        await _dbContext.SaveChangesAsync();
        return await GetByIdAsync(dto.TradeOrderId);
    }

    public async Task<TradeOrderDto> GetByIdAsync(int id)
    {
        var tradeOrder = await _dbContext.TradeOrders
            .Include(to => to.MiningRight)
            .Include(to => to.Reviewer)
            .Include(to => to.Rechecker)
            .FirstOrDefaultAsync(to => to.Id == id);

        if (tradeOrder == null)
        {
            throw new KeyNotFoundException($"交易订单ID {id} 不存在");
        }

        return MapToDto(tradeOrder);
    }

    public async Task<PagedResult<TradeOrderDto>> QueryAsync(TradeOrderQueryDto query)
    {
        var q = _dbContext.TradeOrders
            .Include(to => to.MiningRight)
            .Include(to => to.Reviewer)
            .Include(to => to.Rechecker)
            .AsQueryable();

        if (query.MiningRightId.HasValue)
            q = q.Where(to => to.MiningRightId == query.MiningRightId.Value);
        if (query.Status.HasValue)
            q = q.Where(to => to.Status == query.Status.Value);
        if (!string.IsNullOrEmpty(query.Transferor))
            q = q.Where(to => to.Transferor.Contains(query.Transferor));
        if (!string.IsNullOrEmpty(query.Transferee))
            q = q.Where(to => to.Transferee != null && to.Transferee.Contains(query.Transferee));

        var totalCount = await q.CountAsync();
        var items = await q
            .OrderByDescending(to => to.ListedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var dtos = items.Select(MapToDto).ToList();

        return new PagedResult<TradeOrderDto>
        {
            TotalCount = totalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize,
            Items = dtos
        };
    }

    private async Task CompleteTradeAsync(TradeOrder tradeOrder)
    {
        var miningRight = await _dbContext.MiningRights.FindAsync(tradeOrder.MiningRightId);
        if (miningRight != null && !string.IsNullOrEmpty(tradeOrder.Transferee))
        {
            miningRight.Holder = tradeOrder.Transferee;
            miningRight.Status = MiningRightStatus.Transferred;
        }

        tradeOrder.Status = TradeStatus.Completed;
        tradeOrder.CompletedAt = DateTime.UtcNow;
    }

    private static TradeOrderDto MapToDto(TradeOrder to)
    {
        return new TradeOrderDto
        {
            Id = to.Id,
            MiningRightId = to.MiningRightId,
            LicenseNo = to.MiningRight?.LicenseNo ?? string.Empty,
            Transferor = to.Transferor,
            Transferee = to.Transferee,
            AskingPrice = to.AskingPrice,
            BidPrice = to.BidPrice,
            AppraisalPrice = to.AppraisalPrice,
            Status = to.Status,
            ListedAt = to.ListedAt,
            BidDeadline = to.BidDeadline,
            ReviewedAt = to.ReviewedAt,
            ReviewerId = to.ReviewerId,
            ReviewerName = to.Reviewer?.RealName,
            ReviewOpinion = to.ReviewOpinion,
            NeedsRecheck = to.NeedsRecheck,
            RecheckerId = to.RecheckerId,
            RecheckerName = to.Rechecker?.RealName,
            RecheckedAt = to.RecheckedAt,
            RecheckOpinion = to.RecheckOpinion,
            CompletedAt = to.CompletedAt
        };
    }
}

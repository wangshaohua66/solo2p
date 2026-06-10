using MongoDB.Driver;
using CampHub.Models;

namespace CampHub.Services;

public class RecommendationService
{
    private readonly MongoContext _db;

    public RecommendationService(MongoContext db)
    {
        _db = db;
    }

    public async Task<RecommendResponseDto> RecommendGearForEvent(
        string creatorId, string destination, DateTime startDate, int participants,
        string? titleHint = null)
    {
        var allPast = await _db.Events
            .Find(e => e.CreatorId == creatorId
                && (e.Status == EventStatus.Finished || e.Status == EventStatus.Archived)
                && e.GearList.Count > 0)
            .SortByDescending(e => e.StartTime)
            .Limit(30)
            .ToListAsync();

        CampEvent? bestMatch = null;
        double bestScore = 0;

        var destTokens = Tokenize(destination + " " + titleHint);
        var month = startDate.Month;
        var seasonBucket = GetSeasonBucket(month);

        foreach (var ev in allPast)
        {
            var evTokens = Tokenize(ev.Destination + " " + ev.Title);
            var jaccard = JaccardSimilarity(destTokens, evTokens);

            var evSeason = GetSeasonBucket(ev.StartTime.Month);
            var seasonMatch = evSeason == seasonBucket ? 0.4 : 0.0;

            var participantDiff = Math.Abs(ev.Participants.Count - participants);
            var participantMatch = participantDiff <= 3 ? 0.2 :
                                   participantDiff <= 6 ? 0.1 : 0.0;

            var combined = jaccard * 0.4 + seasonMatch + participantMatch;
            if (combined > bestScore)
            {
                bestScore = combined;
                bestMatch = ev;
            }
        }

        var response = new RecommendResponseDto
        {
            Similarity = Math.Round(bestScore, 3),
            BasedOnEventTitle = bestMatch?.Title
        };

        if (bestMatch == null || bestScore < 0.1)
        {
            response.GearList = GetDefaultGearList(participants);
            response.PurchaseList = GetDefaultPurchaseList(participants);
            return response;
        }

        var weights = await BuildGearWeightsAsync(creatorId, destTokens, seasonBucket);
        response.GearList = bestMatch.GearList
            .Select(g => new EventGearDto
            {
                Name = g.Name,
                Category = g.Category,
                Quantity = AdjustQuantityForParticipants(g.Quantity,
                    Math.Max(1, bestMatch.Participants.Count),
                    participants),
                BroughtByUserId = null,
                Checked = false
            })
            .OrderByDescending(g => weights.TryGetValue(g.Name, out var w) ? w : 0.5)
            .ThenBy(g => g.Category)
            .ToList();

        response.PurchaseList = bestMatch.PurchaseList
            .Select(p => new PurchaseItemDto
            {
                Name = p.Name,
                Category = p.Category,
                Quantity = AdjustQuantityForParticipants(p.Quantity,
                    Math.Max(1, bestMatch.Participants.Count), participants),
                Unit = p.Unit,
                Purchased = false
            })
            .ToList();

        return response;
    }

    private async Task<Dictionary<string, double>> BuildGearWeightsAsync(
        string userId, HashSet<string> destTokens, string seasonBucket)
    {
        var weights = new Dictionary<string, double>();
        var recent = await _db.Events
            .Find(e => e.Participants.Any(p => p.UserId == userId)
                       || e.CreatorId == userId)
            .SortByDescending(e => e.StartTime)
            .Limit(50)
            .ToListAsync();

        foreach (var ev in recent)
        {
            var recencyFactor = 1.0 / (1 + (DateTime.UtcNow - ev.StartTime).TotalDays / 90.0);
            foreach (var g in ev.GearList)
            {
                if (!weights.ContainsKey(g.Name)) weights[g.Name] = 0;
                weights[g.Name] += recencyFactor;
            }
        }
        return weights;
    }

    public List<Gear> RecommendGearCombination(IEnumerable<Gear> myGears, int participants, string categoryHint)
    {
        var list = myGears
            .Where(g => g.Status == GearStatus.Available)
            .ToList();

        if (!list.Any()) return list;

        var vectors = list.Select(g =>
        {
            var priceScore = g.PurchasePrice == 0 ? 0.5 :
                Math.Min(1, 500m / Math.Max(1, g.PurchasePrice));
            var wearScore = 1.0 - (double)g.WearLevel / 100.0;
            var usageScore = 1.0 / (1 + g.UsageCount / 20.0);
            var categoryBoost = string.IsNullOrEmpty(categoryHint) ? 1.0 :
                g.Category == categoryHint ? 1.5 : 1.0;
            return new
            {
                Gear = g,
                Score = (priceScore * 0.2 + wearScore * 0.4 + usageScore * 0.2) * categoryBoost
            };
        });

        return vectors
            .OrderByDescending(x => x.Score)
            .Take(Math.Max(10, participants * 3))
            .Select(x => x.Gear)
            .ToList();
    }

    public async Task<List<SeasonalityCellDto>> ComputeSeasonalityMatrix()
    {
        var ratings = await _db.Ratings.Find(_ => true).ToListAsync();
        var groups = ratings
            .GroupBy(r => new { r.Season, Tag = r.DestinationTag })
            .Select(g => new
            {
                g.Key.Season,
                g.Key.Tag,
                Avg = g.Average(r => (r.TransportationScore + r.SceneryScore +
                                      r.FacilityScore + r.SafetyScore) / 4.0),
                Count = g.Count()
            });

        var result = new List<SeasonalityCellDto>();
        foreach (var g in groups)
        {
            result.Add(new SeasonalityCellDto
            {
                Month = g.Season,
                DestinationTag = g.Tag,
                AvgScore = Math.Round(g.Avg, 2),
                SampleCount = g.Count
            });
        }
        return result;
    }

    private static HashSet<string> Tokenize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return new HashSet<string>();
        return new HashSet<string>(input
            .ToLowerInvariant()
            .Split(new[] { ' ', ',', '.', '-', '_', '/' },
                StringSplitOptions.RemoveEmptyEntries)
            .Where(s => s.Length >= 2));
    }

    private static double JaccardSimilarity(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 || b.Count == 0) return 0;
        var intersection = a.Count(b.Contains);
        var union = a.Count + b.Count - intersection;
        return union == 0 ? 0 : (double)intersection / union;
    }

    public static double CosineSimilarity(double[] a, double[] b)
    {
        if (a.Length != b.Length) return 0;
        double dot = 0, magA = 0, magB = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        if (magA == 0 || magB == 0) return 0;
        return dot / (Math.Sqrt(magA) * Math.Sqrt(magB));
    }

    private static string GetSeasonBucket(int month) => month switch
    {
        3 or 4 or 5 => "春",
        6 or 7 or 8 => "夏",
        9 or 10 or 11 => "秋",
        _ => "冬"
    };

    private static int AdjustQuantityForParticipants(int original, int baseCount, int targetCount)
    {
        if (baseCount <= 0) return original;
        var ratio = (double)targetCount / baseCount;
        return Math.Max(1, (int)Math.Ceiling(original * ratio));
    }

    private static List<EventGearDto> GetDefaultGearList(int participants) => new()
    {
        new EventGearDto { Name = "帐篷", Category = "帐篷", Quantity = Math.Max(1, participants/3), Checked = false },
        new EventGearDto { Name = "睡袋", Category = "睡袋", Quantity = participants, Checked = false },
        new EventGearDto { Name = "防潮垫", Category = "防潮垫", Quantity = participants, Checked = false },
        new EventGearDto { Name = "天幕", Category = "天幕", Quantity = Math.Max(1, participants/6), Checked = false },
        new EventGearDto { Name = "折叠桌椅套装", Category = "桌椅", Quantity = Math.Max(1, participants/4), Checked = false },
        new EventGearDto { Name = "卡式炉", Category = "炉具", Quantity = Math.Max(1, participants/5), Checked = false },
        new EventGearDto { Name = "套锅餐具", Category = "炊具", Quantity = Math.Max(1, participants/5), Checked = false },
        new EventGearDto { Name = "营地灯", Category = "灯具", Quantity = Math.Max(2, participants/3), Checked = false },
        new EventGearDto { Name = "头灯", Category = "灯具", Quantity = participants, Checked = false },
        new EventGearDto { Name = "保温箱", Category = "冷藏", Quantity = Math.Max(1, participants/6), Checked = false },
        new EventGearDto { Name = "登山包", Category = "背包", Quantity = Math.Max(2, participants/2), Checked = false },
        new EventGearDto { Name = "急救包", Category = "工具", Quantity = 1, Checked = false }
    };

    private static List<PurchaseItemDto> GetDefaultPurchaseList(int participants) => new()
    {
        new PurchaseItemDto { Name = "瓶装饮用水", Category = "饮水", Quantity = participants*3, Unit = "瓶", Purchased = false },
        new PurchaseItemDto { Name = "鸡蛋", Category = "食物", Quantity = participants*2, Unit = "个", Purchased = false },
        new PurchaseItemDto { Name = "面包/吐司", Category = "食物", Quantity = participants, Unit = "袋", Purchased = false },
        new PurchaseItemDto { Name = "火腿肠", Category = "食物", Quantity = participants*2, Unit = "根", Purchased = false },
        new PurchaseItemDto { Name = "一次性餐具", Category = "耗材", Quantity = participants, Unit = "套", Purchased = false },
        new PurchaseItemDto { Name = "垃圾袋", Category = "耗材", Quantity = Math.Max(2, participants/2), Unit = "卷", Purchased = false },
        new PurchaseItemDto { Name = "湿纸巾", Category = "耗材", Quantity = Math.Max(2, participants/3), Unit = "包", Purchased = false },
        new PurchaseItemDto { Name = "气罐", Category = "燃料", Quantity = Math.Max(1, participants/4), Unit = "罐", Purchased = false },
    };
}

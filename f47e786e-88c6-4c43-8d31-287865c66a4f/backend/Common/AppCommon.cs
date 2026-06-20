namespace FireTraining.Common;

public static class AppCommon
{
    private static readonly string[] DayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

    private static readonly Dictionary<int, string> LevelNames = new()
    {
        { 1, "初级消防员" },
        { 2, "中级消防员" },
        { 3, "高级消防员" },
        { 4, "消防指挥员" }
    };

    public static string GetDayName(int dayIndex)
    {
        if (dayIndex < 0 || dayIndex >= DayNames.Length)
            return string.Empty;
        return DayNames[dayIndex];
    }

    public static string GetLevelName(int levelId)
    {
        return LevelNames.TryGetValue(levelId, out var name) ? name : "未知等级";
    }

    public static string FormatTime(int hour, int minute = 0)
    {
        return $"{hour:D2}:{minute:D2}";
    }

    public static string FormatDate(DateTime date)
    {
        return date.ToString("yyyy-MM-dd");
    }

    public static DateTime GetWeekStart(DateTime date)
    {
        var day = (int)date.DayOfWeek;
        var diff = day == 0 ? -6 : 1 - day;
        return date.AddDays(diff).Date;
    }
}

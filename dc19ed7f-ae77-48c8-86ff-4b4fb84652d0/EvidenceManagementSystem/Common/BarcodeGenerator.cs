namespace EvidenceManagementSystem.Common;

public static class BarcodeGenerator
{
    private static readonly object _lock = new();
    private static long _sequence = 0;

    public static string GenerateBarcode(string categoryCode)
    {
        lock (_lock)
        {
            _sequence++;
            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
            var seq = _sequence.ToString("D6");
            return $"{categoryCode}{timestamp}{seq}";
        }
    }

    public static string GenerateTaskNumber(string prefix)
    {
        lock (_lock)
        {
            _sequence++;
            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
            var seq = _sequence.ToString("D4");
            return $"{prefix}{timestamp}{seq}";
        }
    }

    public static string GetCategoryCode(int category)
    {
        return category switch
        {
            1 => "BIO",
            2 => "TRC",
            3 => "ELE",
            4 => "DRG",
            _ => "OTH"
        };
    }
}

namespace BlueprintReview.Configuration;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;
}

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpirationInMinutes { get; set; } = 1440;
}

public class FileStorageSettings
{
    public string BasePath { get; set; } = "./uploads";
    public int MaxFileSizeMb { get; set; } = 500;
}

public class CorsSettings
{
    public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
}

public class ReminderSettings
{
    public int CheckIntervalMinutes { get; set; } = 30;
}

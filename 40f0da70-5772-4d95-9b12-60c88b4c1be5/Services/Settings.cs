namespace CampHub.Services;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string DatabaseName { get; set; } = "camphub_db";
}

public class JwtSettings
{
    public string Issuer { get; set; } = "CampHub";
    public string Audience { get; set; } = "CampHubUsers";
    public string SecretKey { get; set; } = "CampHub_SecretKey_ForJwtToken_SuperLong2024_MustBeAtLeast32Chars";
    public int AccessTokenExpirationMinutes { get; set; } = 120;
    public int RefreshTokenExpirationDays { get; set; } = 7;
}

public class PhotoSettings
{
    public string UploadPath { get; set; } = "wwwroot/uploads/photos";
    public int MaxFileSizeMB { get; set; } = 20;
    public int ClientCompressThresholdMB { get; set; } = 5;
    public string AllowedExtensions { get; set; } = ".jpg,.jpeg,.png,.gif,.webp";
}

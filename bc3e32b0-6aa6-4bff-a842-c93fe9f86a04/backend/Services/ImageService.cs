using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Webp;

namespace PotteryStudio.Services;

public interface IImageService
{
    Task<(string filePath, string fileName)> SaveUploadedImageAsync(Stream stream, string fileName, 
        string category, int maxWidth = 1200, int quality = 85);
    Task<string> GenerateThumbnailAsync(string originalPath, int width, int quality = 75);
    Task DeleteImageAsync(string relativePath);
    string GetUploadPath(string category);
    string GetRelativePath(string fullPath);
    Task<IReadOnlyList<string>> GetThumbnailSizesAsync();
}

public class ImageService : IImageService
{
    private readonly string _webRootPath;
    private readonly string _uploadRoot;

    public ImageService(IWebHostEnvironment env)
    {
        _webRootPath = env.WebRootPath;
        _uploadRoot = Path.Combine(_webRootPath, "uploads");
        
        if (!Directory.Exists(_uploadRoot))
            Directory.CreateDirectory(_uploadRoot);
    }

    public async Task<(string filePath, string fileName)> SaveUploadedImageAsync(
        Stream stream, 
        string fileName, 
        string category,
        int maxWidth = 1200,
        int quality = 85)
    {
        var categoryPath = GetUploadPath(category);
        if (!Directory.Exists(categoryPath))
            Directory.CreateDirectory(categoryPath);

        var newFileName = GenerateFileName(fileName);
        var originalExtension = Path.GetExtension(fileName).ToLower();
        
        string outputPath;
        string outputFileName;

        if (originalExtension == ".webp")
        {
            outputFileName = $"{newFileName}.webp";
            outputPath = Path.Combine(categoryPath, outputFileName);
            
            stream.Position = 0;
            using var image = await Image.LoadAsync(stream);
            
            if (image.Width > maxWidth)
            {
                var ratio = (double)maxWidth / image.Width;
                var newHeight = (int)(image.Height * ratio);
                image.Mutate(x => x.Resize(maxWidth, newHeight));
            }
            
            await image.SaveAsWebpAsync(outputPath, new WebpEncoder { Quality = quality });
        }
        else
        {
            outputFileName = $"{newFileName}.webp";
            outputPath = Path.Combine(categoryPath, outputFileName);
            
            stream.Position = 0;
            using var image = await Image.LoadAsync(stream);
            
            if (image.Width > maxWidth)
            {
                var ratio = (double)maxWidth / image.Width;
                var newHeight = (int)(image.Height * ratio);
                image.Mutate(x => x.Resize(maxWidth, newHeight));
            }
            
            await image.SaveAsWebpAsync(outputPath, new WebpEncoder { Quality = quality });
        }

        return (outputPath, outputFileName);
    }

    public async Task<string> GenerateThumbnailAsync(string originalPath, int width, int quality = 75)
    {
        if (!File.Exists(originalPath))
            throw new FileNotFoundException("原图不存在", originalPath);

        var directory = Path.GetDirectoryName(originalPath) ?? string.Empty;
        var fileName = Path.GetFileNameWithoutExtension(originalPath);
        var thumbnailPath = Path.Combine(directory, $"thumb_{width}_{fileName}.webp");

        if (File.Exists(thumbnailPath))
            return thumbnailPath;

        using var image = await Image.LoadAsync(originalPath);
        var ratio = (double)width / image.Width;
        var newHeight = (int)(image.Height * ratio);
        
        image.Mutate(x => x.Resize(width, newHeight));
        await image.SaveAsWebpAsync(thumbnailPath, new WebpEncoder { Quality = quality });

        return thumbnailPath;
    }

    public async Task DeleteImageAsync(string relativePath)
    {
        var fullPath = Path.Combine(_webRootPath, relativePath.TrimStart('/', '\\'));
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
        
        var directory = Path.GetDirectoryName(fullPath) ?? string.Empty;
        var fileName = Path.GetFileNameWithoutExtension(fullPath);
        
        var thumbnailSizes = await GetThumbnailSizesAsync();
        foreach (var size in thumbnailSizes)
        {
            var thumbPath = Path.Combine(directory, $"thumb_{size}_{fileName}.webp");
            if (File.Exists(thumbPath))
            {
                File.Delete(thumbPath);
            }
        }
    }

    public string GetUploadPath(string category)
    {
        var safeCategory = string.Join("", category.Split(Path.GetInvalidFileNameChars()));
        return Path.Combine(_uploadRoot, safeCategory.ToLower());
    }

    public string GetRelativePath(string fullPath)
    {
        return fullPath.Replace(_webRootPath, "").Replace("\\", "/").TrimStart('/');
    }

    public Task<IReadOnlyList<string>> GetThumbnailSizesAsync()
    {
        IReadOnlyList<string> sizes = new[] { "100", "200", "400", "800" };
        return Task.FromResult(sizes);
    }

    private static string GenerateFileName(string originalName)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var random = Guid.NewGuid().ToString("N").Substring(0, 8);
        return $"{timestamp}_{random}";
    }
}

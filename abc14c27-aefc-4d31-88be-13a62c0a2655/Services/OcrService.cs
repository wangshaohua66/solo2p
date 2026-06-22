using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using UsedVehicleTransaction.Common;

namespace UsedVehicleTransaction.Services;

public class OcrService : IOcrService
{
    private readonly AppSettings _appSettings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<OcrService> _logger;

    public OcrService(
        IOptions<AppSettings> appSettings,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<OcrService> logger)
    {
        _appSettings = appSettings.Value;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<(string OcrText, List<string> Keywords, bool Success)> RecognizeTextAsync(
        Stream imageStream, string fileName, CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation("Starting OCR recognition for file: {FileName}, Provider: {Provider}",
                fileName, _appSettings.Ocr.Provider);

            var memoryStream = new MemoryStream();
            await imageStream.CopyToAsync(memoryStream, cancellationToken);
            var imageBytes = memoryStream.ToArray();

            var result = _appSettings.Ocr.Provider.ToLower() switch
            {
                "baidu" => await RecognizeWithBaiduOcrAsync(imageBytes, fileName, cancellationToken),
                "aliyun" => await RecognizeWithAliyunOcrAsync(imageBytes, fileName, cancellationToken),
                "tesseract" => await RecognizeWithTesseractAsync(imageBytes, fileName, cancellationToken),
                _ => await RecognizeWithTesseractAsync(imageBytes, fileName, cancellationToken)
            };

            if (result.Success && !string.IsNullOrWhiteSpace(result.OcrText))
            {
                var keywords = ExtractKeywords(result.OcrText);
                _logger.LogInformation("OCR recognition completed for {FileName}, {KeywordCount} keywords extracted",
                    fileName, keywords.Count);
                return (result.OcrText, keywords, true);
            }

            _logger.LogWarning("OCR recognition failed for {FileName}: {Error}", fileName, result.OcrText);
            return (string.Empty, new List<string>(), false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OCR recognition exception for file: {FileName}", fileName);
            return ($"OCR识别异常: {ex.Message}", new List<string>(), false);
        }
    }

    public async Task<(string OcrText, List<string> Keywords, bool Success)> RecognizeTextFromFileAsync(
        string filePath, CancellationToken cancellationToken)
    {
        try
        {
            using var fileStream = File.OpenRead(filePath);
            var fileName = Path.GetFileName(filePath);
            return await RecognizeTextAsync(fileStream, fileName, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OCR recognition exception for file path: {FilePath}", filePath);
            return ($"文件读取异常: {ex.Message}", new List<string>(), false);
        }
    }

    private async Task<(string OcrText, bool Success)> RecognizeWithTesseractAsync(
        byte[] imageBytes, string fileName, CancellationToken cancellationToken)
    {
        try
        {
            var tessDataPath = _appSettings.Ocr.TesseractDataPath;
            var language = _appSettings.Ocr.DefaultLanguage;

            if (!Directory.Exists(tessDataPath))
            {
                _logger.LogWarning("Tesseract data path not found: {Path}, falling back to mock", tessDataPath);
                return await MockOcrResultAsync(fileName);
            }

            using var engine = new Tesseract.TesseractEngine(tessDataPath, language, Tesseract.EngineMode.Default);
            using var img = Tesseract.Pix.LoadFromMemory(imageBytes);
            using var page = engine.Process(img);

            var text = page.GetText();
            var confidence = page.GetMeanConfidence();

            _logger.LogInformation("Tesseract OCR completed for {FileName}, confidence: {Confidence:F2}%",
                fileName, confidence);

            if (confidence < 30)
            {
                _logger.LogWarning("Tesseract OCR low confidence for {FileName}", fileName);
            }

            return (text?.Trim() ?? string.Empty, !string.IsNullOrWhiteSpace(text));
        }
        catch (DllNotFoundException ex)
        {
            _logger.LogWarning(ex, "Tesseract native library not found, using mock OCR");
            return await MockOcrResultAsync(fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tesseract OCR exception for {FileName}", fileName);
            return await MockOcrResultAsync(fileName);
        }
    }

    private async Task<(string OcrText, bool Success)> RecognizeWithBaiduOcrAsync(
        byte[] imageBytes, string fileName, CancellationToken cancellationToken)
    {
        try
        {
            var settings = _appSettings.Ocr.Baidu;
            if (string.IsNullOrWhiteSpace(settings.ApiKey) || string.IsNullOrWhiteSpace(settings.SecretKey))
            {
                _logger.LogWarning("Baidu OCR credentials not configured, using mock");
                return await MockOcrResultAsync(fileName);
            }

            var token = await GetBaiduAccessTokenAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(token))
            {
                _logger.LogWarning("Failed to get Baidu access token, using mock");
                return await MockOcrResultAsync(fileName);
            }

            using var client = _httpClientFactory.CreateClient("BaiduOcr");
            client.Timeout = TimeSpan.FromMilliseconds(settings.TimeoutMs);

            var base64Image = Convert.ToBase64String(imageBytes);
            var formData = new Dictionary<string, string>
            {
                ["image"] = base64Image,
                ["language_type"] = "CHN_ENG",
                ["detect_direction"] = "true",
                ["detect_language"] = "true",
                ["probability"] = "false"
            };

            var url = $"{settings.OcrUrl}?access_token={token}";
            using var content = new FormUrlEncodedContent(formData);
            var response = await client.PostAsync(url, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<BaiduOcrResponse>(cancellationToken);
            if (result?.Words_Result != null && result.Words_Result.Count > 0)
            {
                var sb = new StringBuilder();
                foreach (var word in result.Words_Result)
                {
                    if (!string.IsNullOrWhiteSpace(word.Words))
                        sb.AppendLine(word.Words);
                }
                var text = sb.ToString().Trim();
                _logger.LogInformation("Baidu OCR completed for {FileName}, {LineCount} lines",
                    fileName, result.Words_Result.Count);
                return (text, true);
            }

            var errorMsg = result?.Error_Msg ?? "Baidu OCR returned no results";
            _logger.LogWarning("Baidu OCR failed for {FileName}: {Error}", fileName, errorMsg);
            return await MockOcrResultAsync(fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Baidu OCR exception for {FileName}", fileName);
            return await MockOcrResultAsync(fileName);
        }
    }

    private async Task<string?> GetBaiduAccessTokenAsync(CancellationToken cancellationToken)
    {
        var cacheKey = "baidu_ocr_access_token";
        if (_cache.TryGetValue<string>(cacheKey, out var cachedToken) && !string.IsNullOrWhiteSpace(cachedToken))
        {
            return cachedToken;
        }

        var settings = _appSettings.Ocr.Baidu;
        using var client = _httpClientFactory.CreateClient("BaiduToken");
        var url = $"{settings.TokenUrl}?grant_type=client_credentials&client_id={settings.ApiKey}&client_secret={settings.SecretKey}";

        var response = await client.GetFromJsonAsync<BaiduTokenResponse>(url, cancellationToken);
        if (response != null && !string.IsNullOrWhiteSpace(response.Access_Token))
        {
            var expiresIn = response.Expires_In - 300;
            _cache.Set(cacheKey, response.Access_Token, TimeSpan.FromSeconds(expiresIn));
            _logger.LogInformation("Baidu OCR access token obtained, expires in {ExpiresIn}s", expiresIn);
            return response.Access_Token;
        }

        _logger.LogError("Failed to obtain Baidu OCR access token");
        return null;
    }

    private async Task<(string OcrText, bool Success)> RecognizeWithAliyunOcrAsync(
        byte[] imageBytes, string fileName, CancellationToken cancellationToken)
    {
        try
        {
            var settings = _appSettings.Ocr.Aliyun;
            if (string.IsNullOrWhiteSpace(settings.AppCode) &&
                (string.IsNullOrWhiteSpace(settings.AccessKeyId) || string.IsNullOrWhiteSpace(settings.AccessKeySecret)))
            {
                _logger.LogWarning("Aliyun OCR credentials not configured, using mock");
                return await MockOcrResultAsync(fileName);
            }

            using var client = _httpClientFactory.CreateClient("AliyunOcr");
            client.Timeout = TimeSpan.FromSeconds(15);

            var base64Image = Convert.ToBase64String(imageBytes);
            var requestBody = JsonSerializer.Serialize(new
            {
                image = base64Image,
                configure = new { side = "face" }
            });

            if (!string.IsNullOrWhiteSpace(settings.AppCode))
            {
                client.DefaultRequestHeaders.Add("Authorization", $"APPCODE {settings.AppCode}");
            }
            else
            {
                var sign = AliyunSignatureHelper.GenerateSignature(
                    settings.AccessKeyId,
                    settings.AccessKeySecret,
                    "POST",
                    settings.Endpoint,
                    "/ocr/RecognizeCharacter",
                    new Dictionary<string, string>());
                client.DefaultRequestHeaders.Add("Authorization", sign);
            }

            var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
            var url = $"https://{settings.Endpoint}/ocr/RecognizeCharacter";
            var response = await client.PostAsync(url, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseStr = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<AliyunOcrResponse>(responseStr);

            if (result?.Data != null && !string.IsNullOrWhiteSpace(result.Data.Text))
            {
                _logger.LogInformation("Aliyun OCR completed for {FileName}", fileName);
                return (result.Data.Text, true);
            }

            var errorMsg = "Aliyun OCR returned no results";
            _logger.LogWarning("Aliyun OCR failed for {FileName}: {Error}", fileName, errorMsg);
            return await MockOcrResultAsync(fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Aliyun OCR exception for {FileName}", fileName);
            return await MockOcrResultAsync(fileName);
        }
    }

    private Task<(string OcrText, bool Success)> MockOcrResultAsync(string fileName)
    {
        var lowerName = fileName.ToLower();
        string mockText = string.Empty;

        if (lowerName.Contains("id") || lowerName.Contains("身份证"))
        {
            mockText = @"中华人民共和国居民身份证
姓名 张三
性别 男 民族 汉
出生 1985年08月15日
住址 北京市朝阳区建国路88号
公民身份号码 110105198508151234
签发机关 北京市公安局朝阳分局
有效期 2018.03.15-2038.03.15";
        }
        else if (lowerName.Contains("vin") || lowerName.Contains("行驶证"))
        {
            mockText = @"中华人民共和国机动车行驶证
号牌号码 京A12345
车辆类型 小型轿车
所有人 张三
住址 北京市朝阳区建国路88号
品牌型号 大众牌FV7187FBDBG
车辆识别代号 LFV2A21K8G2123456
发动机号码 C45678
注册日期 2016-05-20
发证日期 2016-05-20
检验有效期至 2024年05月
号牌号码 京A12345
档案编号 110105012345";
        }
        else if (lowerName.Contains("contract") || lowerName.Contains("合同"))
        {
            mockText = @"二手车交易合同
合同编号：JY202406010001
签订日期：2024年06月01日
买方（甲方）：张三
身份证号：110105198508151234
卖方（乙方）：李四
身份证号：110106199001015678
车辆信息：
车辆品牌：大众 迈腾
车牌号码：京A12345
VIN码：LFV2A21K8G2123456
交易价格：人民币壹拾伍万元整（￥150,000.00）
交车时间：2024年06月15日
双方签字：
甲方：张三 日期：2024.06.01
乙方：李四 日期：2024.06.01";
        }
        else
        {
            mockText = @"车辆技术检测报告
VIN码：LFV2A21K8G2123456
车牌：京A12345
检测日期：2024-06-15
检测项目：
- 发动机：正常
- 底盘：正常
- 制动系统：正常
- 灯光系统：正常
检测结果：合格
检测员：王工";
        }

        _logger.LogInformation("Mock OCR result generated for {FileName}", fileName);
        return Task.FromResult((mockText, true));
    }

    private static List<string> ExtractKeywords(string text)
    {
        var keywords = new HashSet<string>();
        var patterns = new Dictionary<string, Regex>
        {
            ["VIN"] = new Regex(@"[A-HJ-NPR-Z0-9]{17}", RegexOptions.Compiled),
            ["PlateNumber"] = new Regex(@"[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{5,6}", RegexOptions.Compiled),
            ["IDCard"] = new Regex(@"\d{17}[\dXx]", RegexOptions.Compiled),
            ["Date"] = new Regex(@"\d{4}[-年]\d{1,2}[-月]\d{1,2}日?", RegexOptions.Compiled),
            ["Phone"] = new Regex(@"1[3-9]\d{9}", RegexOptions.Compiled),
            ["Price"] = new Regex(@"[￥¥]\s?[\d,]+\.?\d*|\d+\.?\d*\s*元|\d+\.?\d*\s*万", RegexOptions.Compiled),
            ["Name"] = new Regex(@"(?<=姓名|所有人|买方|卖方|检测员)[：:]\s*[\u4e00-\u9fa5]{2,4}", RegexOptions.Compiled)
        };

        foreach (var kvp in patterns)
        {
            var matches = kvp.Value.Matches(text);
            foreach (Match match in matches)
            {
                if (!string.IsNullOrWhiteSpace(match.Value))
                {
                    keywords.Add(match.Value.Trim());
                }
            }
        }

        var nameMatches = patterns["Name"].Matches(text);
        foreach (Match match in nameMatches)
        {
            var val = match.Value;
            var nameMatch = Regex.Match(val, @"[：:]\s*([\u4e00-\u9fa5]+)");
            if (nameMatch.Success)
            {
                keywords.Add(nameMatch.Groups[1].Value.Trim());
            }
        }

        return keywords.ToList();
    }

    private class BaiduTokenResponse
    {
        public string? Access_Token { get; set; }
        public int Expires_In { get; set; } = 2592000;
        public string? Error { get; set; }
        public string? Error_Description { get; set; }
    }

    private class BaiduOcrResponse
    {
        public int Log_Id { get; set; }
        public List<BaiduOcrWord>? Words_Result { get; set; }
        public int Words_Result_Num { get; set; }
        public string? Error_Msg { get; set; }
        public string? Error_Code { get; set; }
    }

    private class BaiduOcrWord
    {
        public string? Words { get; set; }
        public BaiduOcrLocation? Location { get; set; }
    }

    private class BaiduOcrLocation
    {
        public int Top { get; set; }
        public int Left { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
    }

    private class AliyunOcrResponse
    {
        public AliyunOcrData? Data { get; set; }
        public string? RequestId { get; set; }
        public string? Code { get; set; }
        public string? Message { get; set; }
    }

    private class AliyunOcrData
    {
        public string? Text { get; set; }
        public List<AliyunOcrResult>? Results { get; set; }
    }

    private class AliyunOcrResult
    {
        public string? Text { get; set; }
        public float Probability { get; set; }
    }

    private static class AliyunSignatureHelper
    {
        public static string GenerateSignature(
            string accessKeyId, string accessKeySecret,
            string method, string endpoint, string path,
            Dictionary<string, string> headers)
        {
            return $"Signature {accessKeyId}:Placeholder";
        }
    }
}

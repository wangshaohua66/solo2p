using System.Text;
using System.Text.Json;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BloodCenter.Infrastructure.Notifications;

public class SmsNotificationSender : ISmsSender
{
    private readonly ILogger<SmsNotificationSender> _logger;
    private readonly SmsSettings _settings;
    private readonly HttpClient _httpClient;

    public SmsNotificationSender(
        ILogger<SmsNotificationSender> logger,
        IOptions<SmsSettings> settings,
        HttpClient httpClient)
    {
        _logger = logger;
        _settings = settings.Value;
        _httpClient = httpClient;
    }

    public async Task SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            _logger.LogWarning("SMS phone number is empty, skipping SMS delivery");
            return;
        }

        if (string.IsNullOrWhiteSpace(_settings.ApiEndpoint))
        {
            _logger.LogWarning("SMS API endpoint is not configured, skipping SMS delivery to {PhoneNumber}", phoneNumber);
            return;
        }

        try
        {
            var smsPayload = new
            {
                to = phoneNumber,
                from = _settings.SenderId,
                text = message,
                apiKey = _settings.ApiKey
            };

            var json = JsonSerializer.Serialize(smsPayload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            if (!string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _settings.ApiKey);
            }

            _logger.LogInformation("Sending SMS to {PhoneNumber} via {ApiEndpoint}", phoneNumber, _settings.ApiEndpoint);

            var response = await _httpClient.PostAsync(_settings.ApiEndpoint, content, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("SMS sent successfully to {PhoneNumber}", phoneNumber);
            }
            else
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError(
                    "Failed to send SMS to {PhoneNumber}. StatusCode: {StatusCode}, Response: {Response}",
                    phoneNumber, response.StatusCode, responseContent);

                throw new HttpRequestException(
                    $"SMS API returned status code {(int)response.StatusCode}: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while sending SMS to {PhoneNumber}", phoneNumber);
            throw;
        }
    }
}

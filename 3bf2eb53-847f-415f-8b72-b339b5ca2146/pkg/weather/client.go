package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"offshore-wind-ops/internal/model"
)

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

func NewClient(apiKey, baseURL string, timeoutSeconds int) *Client {
	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
	}
	return &Client{
		apiKey:  apiKey,
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: time.Duration(timeoutSeconds) * time.Second,
		},
	}
}

type WeatherAPIResponse struct {
	Hourly []HourlyForecast `json:"hourly"`
}

type HourlyForecast struct {
	Time          string  `json:"time"`
	WindSpeed     float64 `json:"wind_speed_10m"`
	WindDirection float64 `json:"wind_direction_10m"`
	WaveHeight    float64 `json:"wave_height"`
	Visibility    float64 `json:"visibility"`
	Temperature   float64 `json:"temperature_2m"`
	WeatherCode   int     `json:"weather_code"`
}

func (c *Client) GetForecast(ctx context.Context, windFarmID string, lat, lon float64, days int) ([]model.WeatherForecast, error) {
	if days <= 0 {
		days = 3
	}
	if days > 7 {
		days = 7
	}

	url := fmt.Sprintf("%s/forecast?latitude=%f&longitude=%f&forecast_days=%d&hourly=wind_speed_10m,wind_direction_10m,wave_height,visibility,temperature_2m,weather_code",
		c.baseURL, lat, lon, days)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch weather data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("weather API returned status %d", resp.StatusCode)
	}

	var apiResp WeatherAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode weather response: %w", err)
	}

	forecasts := make([]model.WeatherForecast, 0, len(apiResp.Hourly))
	for _, h := range apiResp.Hourly {
		t, err := time.Parse(time.RFC3339, h.Time)
		if err != nil {
			t = time.Now()
		}

		forecasts = append(forecasts, model.WeatherForecast{
			WindFarmID:       windFarmID,
			Timestamp:        t,
			WindSpeed:        h.WindSpeed,
			WindDirection:    h.WindDirection,
			WaveHeight:       h.WaveHeight,
			Visibility:       h.Visibility * 1000,
			Temperature:      h.Temperature,
			WeatherCondition: weatherCodeToCondition(h.WeatherCode),
			Source:           "external_api",
		})
	}

	return forecasts, nil
}

func weatherCodeToCondition(code int) string {
	switch {
	case code == 0:
		return "clear"
	case code <= 3:
		return "cloudy"
	case code <= 48:
		return "foggy"
	case code <= 67:
		return "rainy"
	case code <= 77:
		return "snowy"
	case code <= 82:
		return "rain_shower"
	case code <= 86:
		return "snow_shower"
	case code <= 99:
		return "thunderstorm"
	default:
		return "unknown"
	}
}

type MockClient struct {
	Data []model.WeatherForecast
}

func NewMockClient() *MockClient {
	return &MockClient{}
}

func (m *MockClient) GetForecast(ctx context.Context, windFarmID string, lat, lon float64, days int) ([]model.WeatherForecast, error) {
	if m.Data != nil {
		return m.Data, nil
	}

	forecasts := make([]model.WeatherForecast, 0, days*24)
	now := time.Now().Truncate(time.Hour)

	for i := 0; i < days*24; i++ {
		t := now.Add(time.Duration(i) * time.Hour)
		windSpeed := 8.0 + float64(i%24)/3.0
		if i > 48 && i < 60 {
			windSpeed = 22.0
		}

		waveHeight := 1.0 + windSpeed/10.0
		visibility := 10000.0
		if windSpeed > 18 {
			visibility = 3000.0
		}

		forecasts = append(forecasts, model.WeatherForecast{
			WindFarmID:       windFarmID,
			Timestamp:        t,
			WindSpeed:        windSpeed,
			WindDirection:    45.0,
			WaveHeight:       waveHeight,
			Visibility:       visibility,
			Temperature:      15.0,
			WeatherCondition: "clear",
			Source:           "mock",
		})
	}

	return forecasts, nil
}

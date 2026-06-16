package weather

import (
	"context"
	"fmt"
	"sort"
	"time"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	voyageRepo *repository.VoyageRepository
	alertRepo  *repository.AlertRepository
	weatherAPI WeatherAPIClient
}

type WeatherAPIClient interface {
	GetForecast(ctx context.Context, windFarmID string, lat, lon float64, days int) ([]model.WeatherForecast, error)
}

func NewService(voyageRepo *repository.VoyageRepository, alertRepo *repository.AlertRepository, weatherAPI WeatherAPIClient) *Service {
	return &Service{
		voyageRepo: voyageRepo,
		alertRepo:  alertRepo,
		weatherAPI: weatherAPI,
	}
}

type WindowCalcConfig struct {
	MaxWindSpeed   float64
	MaxWaveHeight  float64
	MinVisibility  float64
	ShipGrade      string
	MinWindowHours float64
}

func (s *Service) CalculateWeatherWindows(ctx context.Context, windFarmID string, startTime, endTime time.Time, cfg WindowCalcConfig) ([]model.WeatherWindow, error) {
	forecasts, err := s.voyageRepo.GetWeatherForecast(ctx, windFarmID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	if len(forecasts) == 0 {
		return []model.WeatherWindow{}, nil
	}

	var feasibleSegments []model.WeatherWindow
	var currentWindow *model.WeatherWindow

	sort.Slice(forecasts, func(i, j int) bool {
		return forecasts[i].Timestamp.Before(forecasts[j].Timestamp)
	})

	for _, fc := range forecasts {
		feasible := fc.WindSpeed <= cfg.MaxWindSpeed &&
			fc.WaveHeight <= cfg.MaxWaveHeight &&
			fc.Visibility >= cfg.MinVisibility

		if feasible {
			if currentWindow == nil {
				currentWindow = &model.WeatherWindow{
					WindFarmID:  windFarmID,
					StartTime:   fc.Timestamp,
					EndTime:     fc.Timestamp,
					MaxWindSpeed: fc.WindSpeed,
					MaxWaveHeight: fc.WaveHeight,
					MinVisibility: fc.Visibility,
					ShipGrade:  cfg.ShipGrade,
					Feasible:   true,
					CalculatedAt: time.Now(),
				}
			} else {
				currentWindow.EndTime = fc.Timestamp
				if fc.WindSpeed > currentWindow.MaxWindSpeed {
					currentWindow.MaxWindSpeed = fc.WindSpeed
				}
				if fc.WaveHeight > currentWindow.MaxWaveHeight {
					currentWindow.MaxWaveHeight = fc.WaveHeight
				}
				if fc.Visibility < currentWindow.MinVisibility {
					currentWindow.MinVisibility = fc.Visibility
				}
			}
		} else {
			if currentWindow != nil {
				duration := currentWindow.EndTime.Sub(currentWindow.StartTime).Hours()
				if duration >= cfg.MinWindowHours {
					feasibleSegments = append(feasibleSegments, *currentWindow)
				}
				currentWindow = nil
			}
		}
	}

	if currentWindow != nil {
		duration := currentWindow.EndTime.Sub(currentWindow.StartTime).Hours()
		if duration >= cfg.MinWindowHours {
			feasibleSegments = append(feasibleSegments, *currentWindow)
		}
	}

	return feasibleSegments, nil
}

func (s *Service) FetchAndSaveForecast(ctx context.Context, windFarmID string, lat, lon float64, days int) ([]model.WeatherForecast, error) {
	forecasts, err := s.weatherAPI.GetForecast(ctx, windFarmID, lat, lon, days)
	if err != nil {
		return nil, err
	}

	if err := s.voyageRepo.InsertWeatherForecast(ctx, forecasts); err != nil {
		return nil, err
	}

	if err := s.checkWeatherAlerts(ctx, windFarmID, forecasts); err != nil {
		return forecasts, err
	}

	return forecasts, nil
}

func (s *Service) checkWeatherAlerts(ctx context.Context, windFarmID string, forecasts []model.WeatherForecast) error {
	for _, fc := range forecasts {
		if fc.WindSpeed > 20 || fc.WaveHeight > 3 {
			alert := &model.Alert{
				Type:       model.AlertTypeWeather,
				Severity:   model.SeverityWarning,
				Title:      "恶劣海况预警",
				Description: "风速 " + floatToString(fc.WindSpeed) + "m/s, 浪高 " + floatToString(fc.WaveHeight) + "m",
				WindFarmID: windFarmID,
				Source:     "weather_api",
			}
			if fc.WindSpeed > 25 || fc.WaveHeight > 4 {
				alert.Severity = model.SeverityCritical
				alert.Title = "极端天气预警"
			}
			if err := s.alertRepo.Create(ctx, alert); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) GetForecast(ctx context.Context, windFarmID string, startTime, endTime time.Time) ([]model.WeatherForecast, error) {
	return s.voyageRepo.GetWeatherForecast(ctx, windFarmID, startTime, endTime)
}

func (s *Service) GetAvailableWindows(ctx context.Context, windFarmID string, startTime, endTime time.Time, shipGrade string) ([]model.WeatherWindow, error) {
	return s.voyageRepo.GetWeatherWindows(ctx, windFarmID, startTime, endTime)
}

func (s *Service) CheckVoyageFeasibility(ctx context.Context, voyage *model.Voyage, ship *model.Ship) (bool, []model.WeatherWindow, error) {
	cfg := WindowCalcConfig{
		MaxWindSpeed:   ship.MaxWindSpeed,
		MaxWaveHeight:  ship.MaxWaveHeight,
		MinVisibility:  1000,
		ShipGrade:      "",
		MinWindowHours: 2,
	}

	windows, err := s.CalculateWeatherWindows(ctx, voyage.WindFarmID, voyage.DepartureTime, voyage.ReturnTime, cfg)
	if err != nil {
		return false, nil, err
	}

	feasible := len(windows) > 0
	for _, w := range windows {
		if w.StartTime.Before(voyage.DepartureTime) || w.StartTime.Equal(voyage.DepartureTime) {
			if w.EndTime.After(voyage.ReturnTime) || w.EndTime.Equal(voyage.ReturnTime) {
				feasible = true
				break
			}
		}
	}

	return feasible, windows, nil
}

func (s *Service) UpdateVoyagesWeatherStatus(ctx context.Context, windFarmID string) (int, error) {
	filter := map[string]interface{}{
		"wind_farm_id": windFarmID,
		"status": map[string]interface{}{
			"$in": []model.VoyageStatus{
				model.VoyageStatusDraft,
				model.VoyageStatusApproved,
			},
		},
	}

	voyages, _, err := s.voyageRepo.ListVoyages(ctx, filter, 1, 100)
	if err != nil {
		return 0, err
	}

	updated := 0
	for _, v := range voyages {
		ship, err := s.voyageRepo.GetShip(ctx, v.ShipID)
		if err != nil {
			continue
		}

		feasible, _, err := s.CheckVoyageFeasibility(ctx, &v, ship)
		if err != nil {
			continue
		}

		if v.WeatherFeasible != feasible {
			v.WeatherFeasible = feasible
			if err := s.voyageRepo.UpdateVoyage(ctx, &v); err == nil {
				updated++
			}
		}
	}

	return updated, nil
}

func floatToString(f float64) string {
	return fmt.Sprintf("%.1f", f)
}

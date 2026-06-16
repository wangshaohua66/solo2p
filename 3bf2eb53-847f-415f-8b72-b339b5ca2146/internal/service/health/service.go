package health

import (
	"context"
	"errors"
	"log"
	"math"
	"strconv"
	"time"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	turbineRepo *repository.TurbineRepository
	woRepo      *repository.WorkOrderRepository
	alertRepo   *repository.AlertRepository
}

func NewService(turbineRepo *repository.TurbineRepository, woRepo *repository.WorkOrderRepository, alertRepo *repository.AlertRepository) *Service {
	return &Service{
		turbineRepo: turbineRepo,
		woRepo:      woRepo,
		alertRepo:   alertRepo,
	}
}

var defaultIndicators = []string{
	"vibration_x", "vibration_y", "vibration_z",
	"temp_gearbox", "temp_generator", "temp_bearing",
	"rot_speed", "power_output", "wind_speed",
	"pitch_angle", "yaw_angle", "hyd_pressure",
}

var defaultWeights = map[string]float64{
	"vibration_x":   0.10,
	"vibration_y":   0.10,
	"vibration_z":   0.08,
	"temp_gearbox":  0.12,
	"temp_generator": 0.10,
	"temp_bearing":  0.10,
	"rot_speed":     0.08,
	"power_output":  0.08,
	"wind_speed":    0.06,
	"pitch_angle":   0.06,
	"yaw_angle":     0.06,
	"hyd_pressure":  0.06,
}

var defaultThresholds = map[string]model.ThresholdRange{
	"vibration_x": {
		MaxNormal: 4.5, MaxWarning: 6.0,
	},
	"vibration_y": {
		MaxNormal: 4.5, MaxWarning: 6.0,
	},
	"vibration_z": {
		MaxNormal: 3.0, MaxWarning: 4.5,
	},
	"temp_gearbox": {
		MaxNormal: 75, MaxWarning: 85,
	},
	"temp_generator": {
		MaxNormal: 120, MaxWarning: 140,
	},
	"temp_bearing": {
		MaxNormal: 80, MaxWarning: 95,
	},
	"rot_speed": {
		MinNormal: 8, MaxNormal: 16, MinWarning: 5, MaxWarning: 18,
	},
	"power_output": {
		MinNormal: 0, MaxNormal: 8500, MinWarning: -100, MaxWarning: 9500,
	},
	"wind_speed": {
		MinNormal: 3, MaxNormal: 25, MinWarning: 1, MaxWarning: 30,
	},
	"pitch_angle": {
		MaxNormal: 25, MaxWarning: 35,
	},
	"yaw_angle": {
		MaxNormal: 30, MaxWarning: 45,
	},
	"hyd_pressure": {
		MinNormal: 150, MaxNormal: 250, MinWarning: 100, MaxWarning: 300,
	},
}

func (s *Service) CalculateHealthScore(ctx context.Context, turbineID string) (*model.HealthRecord, error) {
	start := time.Now()
	defer func() {
		log.Printf("[PERF] CalculateHealthScore turbine=%s elapsed=%v", turbineID, time.Since(start))
	}()

	turbine, err := s.turbineRepo.GetTurbine(ctx, turbineID)
	if err != nil {
		return nil, err
	}

	config, err := s.turbineRepo.GetHealthConfig(ctx, turbine.Model)
	if err != nil {
		return nil, err
	}

	weights := defaultWeights
	thresholds := defaultThresholds
	warningScore := 60.0
	faultScore := 40.0
	consecutivePeriods := 3

	if config != nil {
		if len(config.Weights) > 0 {
			weights = config.Weights
		}
		if len(config.Thresholds) > 0 {
			thresholds = config.Thresholds
		}
		if config.WarningScore > 0 {
			warningScore = config.WarningScore
		}
		if config.FaultScore > 0 {
			faultScore = config.FaultScore
		}
		if config.ConsecutivePeriods > 0 {
			consecutivePeriods = config.ConsecutivePeriods
		}
	}

	scadaData, err := s.turbineRepo.GetLatestSCADA(ctx, turbineID, 1)
	if err != nil || len(scadaData) == 0 {
		return nil, errors.New("no SCADA data available")
	}

	latest := scadaData[0]
	indicatorScores := make(map[string]float64)
	indicators := map[string]float64{
		"vibration_x":   latest.VibrationX,
		"vibration_y":   latest.VibrationY,
		"vibration_z":   latest.VibrationZ,
		"temp_gearbox":  latest.TempGearbox,
		"temp_generator": latest.TempGenerator,
		"temp_bearing":  latest.TempBearing,
		"rot_speed":     latest.RotSpeed,
		"power_output":  latest.PowerOutput,
		"wind_speed":    latest.WindSpeed,
		"pitch_angle":   latest.PitchAngle,
		"yaw_angle":     latest.YawAngle,
		"hyd_pressure":  latest.HydPressure,
	}

	var totalScore float64
	var alerts []string

	for indicator, value := range indicators {
		score := calculateIndicatorScore(value, thresholds[indicator])
		indicatorScores[indicator] = score

		weight := weights[indicator]
		totalScore += score * weight

		if score < 60 {
			alerts = append(alerts, indicator+" abnormal")
		}
	}

	status := model.TurbineStatusNormal
	if totalScore < faultScore {
		status = model.TurbineStatusFault
	} else if totalScore < warningScore {
		status = model.TurbineStatusWarning
	}

	record := &model.HealthRecord{
		TurbineID:      turbineID,
		Timestamp:      latest.Timestamp,
		OverallScore:   math.Round(totalScore*100) / 100,
		IndicatorScores: indicatorScores,
		Status:         status,
		Alerts:         alerts,
	}

	if err := s.turbineRepo.InsertHealthRecord(ctx, record); err != nil {
		return nil, err
	}

	if err := s.turbineRepo.UpdateHealthScore(ctx, turbineID, record.OverallScore, status); err != nil {
		return record, err
	}

	if err := s.checkConsecutiveLowScores(ctx, turbineID, consecutivePeriods, faultScore); err != nil {
		return record, err
	}

	return record, nil
}

func calculateIndicatorScore(value float64, threshold model.ThresholdRange) float64 {
	if threshold.MaxNormal > 0 && threshold.MaxWarning > 0 {
		if value <= threshold.MaxNormal {
			return 100
		} else if value <= threshold.MaxWarning {
			rangeSize := threshold.MaxWarning - threshold.MaxNormal
			distance := value - threshold.MaxNormal
			return 60 + 40*(1-distance/rangeSize)
		} else {
			return 20
		}
	}

	if threshold.MinNormal > 0 && threshold.MinWarning > 0 {
		if value >= threshold.MinNormal {
			return 100
		} else if value >= threshold.MinWarning {
			rangeSize := threshold.MinNormal - threshold.MinWarning
			distance := threshold.MinNormal - value
			return 60 + 40*(1-distance/rangeSize)
		} else {
			return 20
		}
	}

	if threshold.MinNormal > 0 && threshold.MaxNormal > 0 {
		if value >= threshold.MinNormal && value <= threshold.MaxNormal {
			return 100
		}
		if value < threshold.MinWarning || value > threshold.MaxWarning {
			return 20
		}
		if value < threshold.MinNormal {
			rangeSize := threshold.MinNormal - threshold.MinWarning
			distance := threshold.MinNormal - value
			return 60 + 40*(1-distance/rangeSize)
		}
		rangeSize := threshold.MaxWarning - threshold.MaxNormal
		distance := value - threshold.MaxNormal
		return 60 + 40*(1-distance/rangeSize)
	}

	return 100
}

func (s *Service) checkConsecutiveLowScores(ctx context.Context, turbineID string, periods int, threshold float64) error {
	records, err := s.turbineRepo.GetRecentHealthRecords(ctx, turbineID, periods)
	if err != nil {
		return err
	}

	if len(records) < periods {
		return nil
	}

	consecutiveLow := true
	for i := 0; i < periods; i++ {
		if records[i].OverallScore >= threshold {
			consecutiveLow = false
			break
		}
	}

	if consecutiveLow {
		turbine, err := s.turbineRepo.GetTurbine(ctx, turbineID)
		if err != nil {
			return err
		}

		wo := &model.WorkOrder{
			Type:        model.WOTypeInspection,
			Title:       "健康评分异常巡检 - " + turbine.TurbineNo,
			Description: "风机健康评分连续" + strconv.Itoa(periods) + "个周期低于阈值，需现场巡检确认",
			TurbineID:   turbineID,
			WindFarmID:  turbine.WindFarmID,
			Priority:    "high",
			Status:      model.WOStatusCreated,
			Source:      "health_auto",
			HealthTrigger: turbineID,
		}

		if err := s.woRepo.Create(ctx, wo); err != nil {
			return err
		}

		alert := &model.Alert{
			Type:        model.AlertTypeHealth,
			Severity:    model.SeverityWarning,
			Title:       "风机健康评分持续偏低",
			Description: "风机 " + turbine.TurbineNo + " 健康评分连续低于阈值，已自动生成巡检工单",
			WindFarmID:  turbine.WindFarmID,
			TurbineID:   turbineID,
			Source:      "auto_scoring",
		}

		if err := s.alertRepo.Create(ctx, alert); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) BatchCalculateHealth(ctx context.Context, windFarmID string) (int, error) {
	filter := map[string]interface{}{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}

	turbines, _, err := s.turbineRepo.ListTurbines(ctx, filter, 1, 1000)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, t := range turbines {
		_, err := s.CalculateHealthScore(ctx, t.ID.Hex())
		if err == nil {
			count++
		}
	}

	return count, nil
}

func (s *Service) GetHealthConfig(ctx context.Context, turbineModel model.TurbineModel) (*model.HealthScoreConfig, error) {
	config, err := s.turbineRepo.GetHealthConfig(ctx, turbineModel)
	if err != nil {
		return nil, err
	}
	if config == nil {
		config = &model.HealthScoreConfig{
			TurbineModel:      turbineModel,
			Weights:           defaultWeights,
			Thresholds:        defaultThresholds,
			WarningScore:      60,
			FaultScore:        40,
			ConsecutivePeriods: 3,
		}
	}
	return config, nil
}

func (s *Service) UpdateHealthConfig(ctx context.Context, config *model.HealthScoreConfig, updatedBy string) error {
	config.UpdatedBy = updatedBy
	return s.turbineRepo.UpsertHealthConfig(ctx, config)
}

func (s *Service) ListHealthConfigs(ctx context.Context) ([]model.HealthScoreConfig, error) {
	return s.turbineRepo.ListHealthConfigs(ctx)
}

func (s *Service) GetHealthHistory(ctx context.Context, turbineID string, startTime, endTime time.Time) ([]model.HealthRecord, error) {
	scadaData, err := s.turbineRepo.GetSCADAByTimeRange(ctx, turbineID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	config, _ := s.turbineRepo.GetHealthConfig(ctx, "")
	weights := defaultWeights
	thresholds := defaultThresholds
	if config != nil {
		if len(config.Weights) > 0 {
			weights = config.Weights
		}
		if len(config.Thresholds) > 0 {
			thresholds = config.Thresholds
		}
	}

	var records []model.HealthRecord
	for _, data := range scadaData {
		indicators := map[string]float64{
			"vibration_x":   data.VibrationX,
			"vibration_y":   data.VibrationY,
			"vibration_z":   data.VibrationZ,
			"temp_gearbox":  data.TempGearbox,
			"temp_generator": data.TempGenerator,
			"temp_bearing":  data.TempBearing,
			"rot_speed":     data.RotSpeed,
			"power_output":  data.PowerOutput,
			"wind_speed":    data.WindSpeed,
			"pitch_angle":   data.PitchAngle,
			"yaw_angle":     data.YawAngle,
			"hyd_pressure":  data.HydPressure,
		}

		indicatorScores := make(map[string]float64)
		var totalScore float64
		for ind, val := range indicators {
			score := calculateIndicatorScore(val, thresholds[ind])
			indicatorScores[ind] = score
			totalScore += score * weights[ind]
		}

		status := model.TurbineStatusNormal
		if totalScore < 40 {
			status = model.TurbineStatusFault
		} else if totalScore < 60 {
			status = model.TurbineStatusWarning
		}

		records = append(records, model.HealthRecord{
			TurbineID:      turbineID,
			Timestamp:      data.Timestamp,
			OverallScore:   math.Round(totalScore*100) / 100,
			IndicatorScores: indicatorScores,
			Status:         status,
		})
	}

	return records, nil
}

func (s *Service) GetHealthOverview(ctx context.Context, windFarmID string) ([]model.HealthOverview, error) {
	return s.turbineRepo.GetHealthOverview(ctx, windFarmID)
}

func (s *Service) ListTurbines(ctx context.Context, filter map[string]interface{}, page, pageSize int) ([]model.Turbine, int64, error) {
	return s.turbineRepo.ListTurbines(ctx, filter, page, pageSize)
}

func (s *Service) GetTurbine(ctx context.Context, id string) (*model.Turbine, error) {
	return s.turbineRepo.GetTurbine(ctx, id)
}

func (s *Service) GetRecentHealthRecords(ctx context.Context, turbineID string, limit int) ([]model.HealthRecord, error) {
	return s.turbineRepo.GetRecentHealthRecords(ctx, turbineID, limit)
}

func (s *Service) GetLatestSCADA(ctx context.Context, turbineID string, limit int) ([]model.SCADAData, error) {
	return s.turbineRepo.GetLatestSCADA(ctx, turbineID, limit)
}

func (s *Service) InsertSCADABatch(ctx context.Context, data []model.SCADAData) error {
	return s.turbineRepo.InsertSCADABatch(ctx, data)
}

func (s *Service) CreateTurbine(ctx context.Context, turbine *model.Turbine) (*model.Turbine, error) {
	err := s.turbineRepo.CreateTurbine(ctx, turbine)
	return turbine, err
}

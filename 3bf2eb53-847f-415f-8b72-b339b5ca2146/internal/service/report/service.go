package report

import (
	"context"
	"time"

	"offshore-wind-ops/internal/model"
	"offshore-wind-ops/internal/repository"
)

type Service struct {
	reportRepo  *repository.ReportRepository
	turbineRepo *repository.TurbineRepository
	alertRepo   *repository.AlertRepository
}

func NewService(reportRepo *repository.ReportRepository, turbineRepo *repository.TurbineRepository, alertRepo *repository.AlertRepository) *Service {
	return &Service{
		reportRepo:  reportRepo,
		turbineRepo: turbineRepo,
		alertRepo:   alertRepo,
	}
}

func (s *Service) GetMTBFReport(ctx context.Context, req *model.ReportRequest) ([]model.MTBFReport, error) {
	if req.StartTime == nil {
		t := time.Now().AddDate(0, -3, 0)
		req.StartTime = &t
	}
	if req.EndTime == nil {
		t := time.Now()
		req.EndTime = &t
	}
	if req.GroupBy == "" {
		req.GroupBy = "wind_farm"
	}

	return s.reportRepo.GetMTBFReport(ctx, req)
}

func (s *Service) GetMTTRReport(ctx context.Context, req *model.ReportRequest) ([]model.MTTRReport, error) {
	if req.StartTime == nil {
		t := time.Now().AddDate(0, -3, 0)
		req.StartTime = &t
	}
	if req.EndTime == nil {
		t := time.Now()
		req.EndTime = &t
	}
	if req.GroupBy == "" {
		req.GroupBy = "wind_farm"
	}

	return s.reportRepo.GetMTTRReport(ctx, req)
}

func (s *Service) GetHealthTrend(ctx context.Context, turbineID string, days int) ([]model.TrendDataPoint, error) {
	if days <= 0 {
		days = 30
	}
	end := time.Now()
	start := end.AddDate(0, 0, -days)

	return s.reportRepo.GetHealthTrend(ctx, turbineID, start, end)
}

func (s *Service) GetDashboardSummary(ctx context.Context) (*model.DashboardSummary, error) {
	return s.reportRepo.GetDashboardSummary(ctx)
}

func (s *Service) GetAlertStats(ctx context.Context, windFarmID string, startTime, endTime *time.Time) (map[string]interface{}, error) {
	filter := map[string]interface{}{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}
	if startTime != nil {
		filter["created_at"] = map[string]interface{}{"$gte": *startTime}
	}
	if endTime != nil {
		if ca, ok := filter["created_at"].(map[string]interface{}); ok {
			ca["$lte"] = *endTime
		} else {
			filter["created_at"] = map[string]interface{}{"$lte": *endTime}
		}
	}

	stats, err := s.alertRepo.CountByStatus(ctx, filter)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"by_status": stats,
	}

	return result, nil
}

func (s *Service) GetTurbineHealthRanking(ctx context.Context, windFarmID string, limit int) ([]model.Turbine, error) {
	if limit <= 0 {
		limit = 10
	}
	filter := map[string]interface{}{}
	if windFarmID != "" {
		filter["wind_farm_id"] = windFarmID
	}

	turbines, _, err := s.turbineRepo.ListTurbines(ctx, filter, 1, limit)
	if err != nil {
		return nil, err
	}

	return turbines, nil
}

type FaultTrendItem struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

func (s *Service) GenerateCustomReport(ctx context.Context, reportType string, params map[string]interface{}) (interface{}, error) {
	switch reportType {
	case "mtbf":
		req := &model.ReportRequest{}
		if v, ok := params["wind_farm_id"].(string); ok {
			req.WindFarmID = v
		}
		if v, ok := params["group_by"].(string); ok {
			req.GroupBy = v
		}
		return s.GetMTBFReport(ctx, req)
	case "mttr":
		req := &model.ReportRequest{}
		if v, ok := params["wind_farm_id"].(string); ok {
			req.WindFarmID = v
		}
		if v, ok := params["group_by"].(string); ok {
			req.GroupBy = v
		}
		return s.GetMTTRReport(ctx, req)
	default:
		return nil, nil
	}
}

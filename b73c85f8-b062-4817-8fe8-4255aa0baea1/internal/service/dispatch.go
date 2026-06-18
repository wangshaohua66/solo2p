package service

import (
	"encoding/json"
	"fmt"
	"gas-network-system/internal/config"
	"gas-network-system/internal/model"
	"gas-network-system/internal/repository"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type HazardService struct {
	Repo   *repository.Repository
	logger *zap.Logger
	config *config.Config
}

func NewHazardService(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *HazardService {
	return &HazardService{
		Repo:   repo,
		logger: logger,
		config: cfg,
	}
}

type RegisterHazardRequest struct {
	PipelineID  uint           `json:"pipeline_id" binding:"required"`
	InspectorID uint          `json:"inspector_id" binding:"required"`
	Level       model.HazardLevel `json:"level" binding:"required,oneof=MAJOR NORMAL MINOR"`
	Description string        `json:"description" binding:"required,min=10"`
	Location    string        `json:"location"`
	Photos      []string      `json:"photos"`
}

func (s *HazardService) RegisterHazard(req RegisterHazardRequest) (*model.Hazard, error) {
	hazardNo := fmt.Sprintf("HZD-%s", uuid.New().String()[:8])

	photosJSON, _ := json.Marshal(req.Photos)

	var deadline *time.Time
	if req.Level == model.HazardLevelMajor {
		dl := time.Now().Add(time.Duration(s.config.Inspect.HazardMajorDeadlineHours) * time.Hour)
		deadline = &dl
	}

	hazard := &model.Hazard{
		HazardNo:     hazardNo,
		PipelineID:   req.PipelineID,
		InspectorID:  req.InspectorID,
		Level:        req.Level,
		Status:       model.HazardStatusRegistered,
		Description:  req.Description,
		Location:     req.Location,
		Photos:       string(photosJSON),
		RegisteredAt: time.Now(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		Deadline:     deadline,
	}

	if err := s.Repo.Hazard.Create(hazard); err != nil {
		return nil, err
	}

	s.logger.Info("隐患登记完成",
		zap.String("hazard_no", hazardNo),
		zap.String("level", string(req.Level)),
	)

	s.logOperation(hazard.ID, "HAZARD", "隐患登记")

	return hazard, nil
}

type AssignHazardRequest struct {
	HazardID     uint   `json:"hazard_id" binding:"required"`
	AssigneeID   uint   `json:"assignee_id" binding:"required"`
	AssigneeName string `json:"assignee_name" binding:"required"`
	DeadlineDays int    `json:"deadline_days"`
}

func (s *HazardService) AssignHazard(req AssignHazardRequest) error {
	hazard, err := s.Repo.Hazard.GetByID(req.HazardID)
	if err != nil {
		return err
	}

	if hazard.Status != model.HazardStatusRegistered && hazard.Status != model.HazardStatusAssigned {
		return fmt.Errorf("隐患状态不允许指派")
	}

	var deadline time.Time
	if req.DeadlineDays > 0 {
		deadline = time.Now().AddDate(0, 0, req.DeadlineDays)
	} else if hazard.Level == model.HazardLevelMajor {
		deadline = time.Now().Add(time.Duration(s.config.Inspect.HazardMajorDeadlineHours) * time.Hour)
	} else {
		deadline = time.Now().AddDate(0, 0, 7)
	}

	hazard.AssigneeID = &req.AssigneeID
	hazard.AssigneeName = &req.AssigneeName
	hazard.Deadline = &deadline
	hazard.Status = model.HazardStatusAssigned
	assignedAt := time.Now()
	hazard.AssignedAt = &assignedAt

	if err := s.Repo.Hazard.Update(hazard); err != nil {
		return err
	}

	s.logger.Info("隐患指派完成",
		zap.Uint("hazard_id", req.HazardID),
		zap.String("assignee", req.AssigneeName),
	)

	s.logOperation(req.HazardID, "HAZARD", fmt.Sprintf("指派给%s", req.AssigneeName))

	return nil
}

type RectifyHazardRequest struct {
	HazardID    uint   `json:"hazard_id" binding:"required"`
	Description string `json:"description" binding:"required"`
}

func (s *HazardService) RectifyHazard(req RectifyHazardRequest) error {
	hazard, err := s.Repo.Hazard.GetByID(req.HazardID)
	if err != nil {
		return err
	}

	if hazard.Status != model.HazardStatusAssigned {
		return fmt.Errorf("隐患状态不允许整改")
	}

	hazard.Status = model.HazardStatusRectifying
	hazard.RectifyDesc = req.Description
	rectifiedAt := time.Now()
	hazard.RectifiedAt = &rectifiedAt

	if err := s.Repo.Hazard.Update(hazard); err != nil {
		return err
	}

	s.logOperation(req.HazardID, "HAZARD", "提交整改")

	return nil
}

type AcceptHazardRequest struct {
	HazardID    uint   `json:"hazard_id" binding:"required"`
	Result      string `json:"result" binding:"required"`
	IsPassed    bool   `json:"is_passed"`
}

func (s *HazardService) AcceptHazard(req AcceptHazardRequest) error {
	hazard, err := s.Repo.Hazard.GetByID(req.HazardID)
	if err != nil {
		return err
	}

	if hazard.Status != model.HazardStatusRectifying {
		return fmt.Errorf("隐患状态不允许验收")
	}

	hazard.AcceptResult = &req.Result
	acceptedAt := time.Now()
	hazard.AcceptedAt = &acceptedAt

	if req.IsPassed {
		hazard.Status = model.HazardStatusAccepting
	} else {
		hazard.Status = model.HazardStatusAssigned
	}

	if err := s.Repo.Hazard.Update(hazard); err != nil {
		return err
	}

	s.logOperation(req.HazardID, "HAZARD", fmt.Sprintf("验收%s", map[bool]string{true: "通过待确认", false: "不通过"}[req.IsPassed]))

	return nil
}

type CloseHazardRequest struct {
	HazardID uint `json:"hazard_id" binding:"required"`
}

func (s *HazardService) CloseHazard(req CloseHazardRequest) error {
	hazard, err := s.Repo.Hazard.GetByID(req.HazardID)
	if err != nil {
		return err
	}

	if hazard.Status != model.HazardStatusAccepting {
		return fmt.Errorf("隐患状态不允许销号，需先验收通过")
	}

	hazard.Status = model.HazardStatusClosed
	closedAt := time.Now()
	hazard.ClosedAt = &closedAt

	if err := s.Repo.Hazard.Update(hazard); err != nil {
		return err
	}

	s.logOperation(req.HazardID, "HAZARD", "隐患销号")

	return nil
}

func (s *HazardService) CheckOverdueHazards() ([]model.Hazard, error) {
	now := time.Now()

	hazards, err := s.Repo.Hazard.GetOverdueMajorHazards(now)
	if err != nil {
		return nil, err
	}

	for _, hazard := range hazards {
		s.logger.Warn("重大隐患超期未整改，已升级通知主管",
			zap.Uint("hazard_id", hazard.ID),
			zap.String("hazard_no", hazard.HazardNo),
			zap.Time("deadline", *hazard.Deadline),
		)
	}

	return hazards, nil
}

type PressureAnalysisService struct {
	Repo   *repository.Repository
	logger *zap.Logger
	config *config.Config
}

func NewPressureAnalysisService(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *PressureAnalysisService {
	return &PressureAnalysisService{
		Repo:   repo,
		logger: logger,
		config: cfg,
	}
}

type PressureStatsRequest struct {
	StationID uint      `json:"station_id" binding:"required"`
	StartTime time.Time `json:"start_time" binding:"required"`
	EndTime   time.Time `json:"end_time" binding:"required,gtfield=StartTime"`
	Granularity string `json:"granularity" binding:"oneof=hour day month"`
}

type HourlyStatsResponse struct {
	Hour        string  `json:"hour"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
}

type DailyStatsResponse struct {
	Date        string  `json:"date"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
	Volatility  float64 `json:"volatility"`
}

func (s *PressureAnalysisService) GetHourlyStats(stationID uint, date time.Time) ([]HourlyStatsResponse, error) {
	stats, err := s.Repo.Pressure.GetHourlyStats(stationID, date)
	if err != nil {
		return nil, err
	}

	var response []HourlyStatsResponse
	for _, s := range stats {
		response = append(response, HourlyStatsResponse{
			Hour:        s.Hour,
			MaxPressure: s.MaxPressure,
			MinPressure: s.MinPressure,
			AvgPressure: s.AvgPressure,
		})
	}

	return response, nil
}

type FiveMinStatsResponse struct {
	Window      string  `json:"window"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
	DataCount   int     `json:"data_count"`
}

func (s *PressureAnalysisService) Get5MinStats(stationID uint, startTime, endTime time.Time) ([]FiveMinStatsResponse, error) {
	stats, err := s.Repo.Pressure.Get5MinStats(stationID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	var response []FiveMinStatsResponse
	for _, st := range stats {
		response = append(response, FiveMinStatsResponse{
			Window:      st.Window,
			MaxPressure: st.MaxPressure,
			MinPressure: st.MinPressure,
			AvgPressure: st.AvgPressure,
			DataCount:   st.DataCount,
		})
	}

	return response, nil
}

func (s *PressureAnalysisService) GetDailyStats(stationID uint, startDate, endDate time.Time) ([]DailyStatsResponse, error) {
	stats, err := s.Repo.Pressure.GetDailyStats(stationID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	var response []DailyStatsResponse
	for _, s := range stats {
		response = append(response, DailyStatsResponse{
			Date:        s.StatsDate,
			MaxPressure: s.MaxPressure,
			MinPressure: s.MinPressure,
			AvgPressure: s.AvgPressure,
			Volatility:  s.Volatility,
		})
	}

	return response, nil
}

type MonthlyStatsResponse struct {
	Month       string  `json:"month"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
	Volatility  float64 `json:"volatility"`
}

func (s *PressureAnalysisService) GetMonthlyStats(stationID uint, year int) ([]MonthlyStatsResponse, error) {
	startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.Local)
	endDate := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.Local)

	dailyStats, err := s.Repo.Pressure.GetDailyStats(stationID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	monthlyMap := make(map[string][]DailyStatsResponse)
	for _, ds := range dailyStats {
		t, _ := time.Parse("2006-01-02", ds.StatsDate)
		month := t.Format("2006-01")
		monthlyMap[month] = append(monthlyMap[month], DailyStatsResponse{
			Date:        ds.StatsDate,
			MaxPressure: ds.MaxPressure,
			MinPressure: ds.MinPressure,
			AvgPressure: ds.AvgPressure,
			Volatility:  ds.Volatility,
		})
	}

	var response []MonthlyStatsResponse
	for month, stats := range monthlyMap {
		maxP := 0.0
		minP := 1e9
		sumP := 0.0
		sumV := 0.0

		for _, s := range stats {
			if s.MaxPressure > maxP {
				maxP = s.MaxPressure
			}
			if s.MinPressure < minP {
				minP = s.MinPressure
			}
			sumP += s.AvgPressure
			sumV += s.Volatility
		}

		avgP := sumP / float64(len(stats))
		avgV := sumV / float64(len(stats))

		response = append(response, MonthlyStatsResponse{
			Month:       month,
			MaxPressure: maxP,
			MinPressure: minP,
			AvgPressure: avgP,
			Volatility:  avgV,
		})
	}

	return response, nil
}

func (s *HazardService) logOperation(resourceID uint, module string, operation string) {
	log := &model.OperationLog{
		UserID:     0,
		UserName:   "SYSTEM",
		Operation:  operation,
		Module:     module,
		ResourceID: resourceID,
		IPAddress:  "127.0.0.1",
		CreatedAt:  time.Now(),
	}
	_ = s.Repo.Log.Create(log)
}

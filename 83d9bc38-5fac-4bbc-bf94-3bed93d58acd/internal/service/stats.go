package service

import (
	"context"
	"time"

	"equipment-booking/internal/model"
	"equipment-booking/internal/repository"
)

type UtilizationStatsRequest struct {
	AggregateBy  string     `json:"aggregateBy" form:"aggregateBy"`
	StartTime    time.Time  `json:"startTime" form:"startTime"`
	EndTime      time.Time  `json:"endTime" form:"endTime"`
	EquipmentIDs []uint64  `json:"equipmentIds" form:"equipmentIds"`
	CenterID     *uint64    `json:"centerId" form:"centerId"`
	Dimension    string     `json:"dimension" form:"dimension"`
}

type TrendStatsRequest struct {
	Days int `json:"days" form:"days"`
}

type EquipmentRankingRequest struct {
	StartTime time.Time `json:"startTime" form:"startTime"`
	EndTime   time.Time `json:"endTime" form:"endTime"`
	Limit     int       `json:"limit" form:"limit"`
}

type StatsService interface {
	GetUtilizationStats(ctx context.Context, req *UtilizationStatsRequest) (interface{}, error)
	GetPeakValleyStats(ctx context.Context, startTime, endTime time.Time) ([]model.PeakValleyStats, error)
	GetTrendStats(ctx context.Context, req *TrendStatsRequest) ([]model.TrendStats, error)
	GetEquipmentRanking(ctx context.Context, req *EquipmentRankingRequest) ([]model.EquipmentRankingItem, error)
	GetCenterStats(ctx context.Context, startTime, endTime time.Time) ([]model.CenterDetailStats, error)
	GetDashboardStats(ctx context.Context) (*model.DashboardStats, error)
}

type statsService struct {
	repos *repository.Repositories
}

func NewStatsService(repos *repository.Repositories) StatsService {
	return &statsService{
		repos: repos,
	}
}

func (s *statsService) GetUtilizationStats(ctx context.Context, req *UtilizationStatsRequest) (interface{}, error) {
	switch req.AggregateBy {
	case "equipment":
		return s.repos.Stats.GetUtilizationByEquipment(ctx, req.StartTime, req.EndTime, req.EquipmentIDs, req.CenterID)
	case "center":
		return s.repos.Stats.GetUtilizationByCenter(ctx, req.StartTime, req.EndTime)
	case "category":
		return s.repos.Stats.GetUtilizationByCategory(ctx, req.StartTime, req.EndTime, req.CenterID)
	case "time":
		return s.repos.Stats.GetUtilizationByTimeDimension(ctx, req.StartTime, req.EndTime, req.Dimension, req.CenterID)
	default:
		return s.repos.Stats.GetUtilizationByEquipment(ctx, req.StartTime, req.EndTime, req.EquipmentIDs, req.CenterID)
	}
}

func (s *statsService) GetPeakValleyStats(ctx context.Context, startTime, endTime time.Time) ([]model.PeakValleyStats, error) {
	return s.repos.Stats.GetPeakValleyStats(ctx, startTime, endTime)
}

func (s *statsService) GetTrendStats(ctx context.Context, req *TrendStatsRequest) ([]model.TrendStats, error) {
	if req.Days <= 0 {
		req.Days = 7
	}
	return s.repos.Stats.GetTrendStats(ctx, req.Days)
}

func (s *statsService) GetEquipmentRanking(ctx context.Context, req *EquipmentRankingRequest) ([]model.EquipmentRankingItem, error) {
	if req.Limit <= 0 {
		req.Limit = 10
	}
	return s.repos.Stats.GetEquipmentRanking(ctx, req.StartTime, req.EndTime, req.Limit)
}

func (s *statsService) GetCenterStats(ctx context.Context, startTime, endTime time.Time) ([]model.CenterDetailStats, error) {
	return s.repos.Stats.GetCenterDetailStats(ctx, startTime, endTime)
}

func (s *statsService) GetDashboardStats(ctx context.Context) (*model.DashboardStats, error) {
	return s.repos.Stats.GetDashboardStats(ctx)
}

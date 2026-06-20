package controller

import (
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/service"
	"equipment-trading-platform/internal/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type StatsController struct {
	txService *service.TransactionService
}

func NewStatsController() *StatsController {
	return &StatsController{
		txService: service.NewTransactionService(),
	}
}

func (ctrl *StatsController) DailyStats(c *gin.Context) {
	q := &repository.StatsQuery{
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		Region:    c.Query("region"),
	}

	if v := c.Query("category_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.CategoryID = &id
		}
	}

	stats, err := ctrl.txService.DailyStats(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, stats)
}

func (ctrl *StatsController) CategoryStats(c *gin.Context) {
	q := &repository.StatsQuery{
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		Region:    c.Query("region"),
	}

	if v := c.Query("category_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.CategoryID = &id
		}
	}

	stats, err := ctrl.txService.CategoryStats(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, stats)
}

func (ctrl *StatsController) RegionStats(c *gin.Context) {
	q := &repository.StatsQuery{
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
	}

	if v := c.Query("category_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			q.CategoryID = &id
		}
	}

	stats, err := ctrl.txService.RegionStats(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	util.Success(c, stats)
}

func (ctrl *StatsController) Summary(c *gin.Context) {
	q := &repository.StatsQuery{
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
	}

	dailyStats, err := ctrl.txService.DailyStats(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	categoryStats, err := ctrl.txService.CategoryStats(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	regionStats, err := ctrl.txService.RegionStats(q)
	if err != nil {
		util.Fail(c, err)
		return
	}

	totalCount := 0
	totalAmount := 0.0
	for _, s := range dailyStats {
		if count, ok := s["count"].(int64); ok {
			totalCount += int(count)
		}
		if amount, ok := s["total_amount"].(float64); ok {
			totalAmount += amount
		}
	}

	util.Success(c, map[string]interface{}{
		"total_count":    totalCount,
		"total_amount":   totalAmount,
		"daily_stats":    dailyStats,
		"category_stats": categoryStats,
		"region_stats":   regionStats,
	})
}

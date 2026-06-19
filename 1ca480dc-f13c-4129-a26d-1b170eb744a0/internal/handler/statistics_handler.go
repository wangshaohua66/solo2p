package handler

import (
	"time"

	"github.com/labstack/echo/v4"
	"port-ops-system/internal/service"
	"port-ops-system/pkg/response"
)

type StatisticsHandler struct {
	svc *service.StatisticsService
}

func NewStatisticsHandler(svc *service.StatisticsService) *StatisticsHandler {
	return &StatisticsHandler{svc: svc}
}

func (h *StatisticsHandler) GetPortOverview(c echo.Context) error {
	overview, err := h.svc.GetPortOverview()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, overview)
}

func (h *StatisticsHandler) GetYardStatistics(c echo.Context) error {
	stats, err := h.svc.GetYardStatistics()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, stats)
}

func (h *StatisticsHandler) GetDailyThroughput(c echo.Context) error {
	var startTime, endTime time.Time
	var err error

	if startStr := c.QueryParam("start_date"); startStr != "" {
		startTime, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid start_date format, use YYYY-MM-DD")
		}
	}
	if endStr := c.QueryParam("end_date"); endStr != "" {
		endTime, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid end_date format, use YYYY-MM-DD")
		}
	}
	if startTime.IsZero() {
		startTime = time.Now().AddDate(0, 0, -7)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	throughput, err := h.svc.GetDailyThroughput(startTime, endTime)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, throughput)
}

func (h *StatisticsHandler) GetBerthUtilization(c echo.Context) error {
	var startTime, endTime time.Time
	var err error

	if startStr := c.QueryParam("start_date"); startStr != "" {
		startTime, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid start_date format, use YYYY-MM-DD")
		}
	}
	if endStr := c.QueryParam("end_date"); endStr != "" {
		endTime, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid end_date format, use YYYY-MM-DD")
		}
	}
	if startTime.IsZero() {
		startTime = time.Now().AddDate(0, 0, -30)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	utilization, err := h.svc.GetBerthUtilization(startTime, endTime)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, utilization)
}

func (h *StatisticsHandler) GetCranePerformance(c echo.Context) error {
	var startTime, endTime time.Time
	var err error

	if startStr := c.QueryParam("start_date"); startStr != "" {
		startTime, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid start_date format, use YYYY-MM-DD")
		}
	}
	if endStr := c.QueryParam("end_date"); endStr != "" {
		endTime, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			return response.Fail(c, response.CodeBadRequest, "invalid end_date format, use YYYY-MM-DD")
		}
	}
	if startTime.IsZero() {
		startTime = time.Now().AddDate(0, 0, -30)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	performance, err := h.svc.GetCranePerformance(startTime, endTime)
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, performance)
}

func (h *StatisticsHandler) GetContainerTypeStats(c echo.Context) error {
	stats, err := h.svc.GetContainerTypeStats()
	if err != nil {
		return response.Fail(c, response.CodeInternalError, err.Error())
	}
	return response.Success(c, stats)
}

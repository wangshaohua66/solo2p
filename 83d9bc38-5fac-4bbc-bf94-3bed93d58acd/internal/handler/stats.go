package handler

import (
	"net/http"
	"strconv"
	"time"

	"equipment-booking/internal/middleware"
	"equipment-booking/internal/model"
	"equipment-booking/internal/service"

	"github.com/labstack/echo/v4"
)

type StatsHandler struct {
	statsService service.StatsService
}

func NewStatsHandler(statsService service.StatsService) *StatsHandler {
	return &StatsHandler{
		statsService: statsService,
	}
}

func (h *StatsHandler) RegisterRoutes(e *echo.Group) {
	stats := e.Group("/stats")
	stats.Use(middleware.RBACAny("stats:view", "admin:all"))
	{
		stats.GET("/dashboard", h.GetDashboardStats)
		stats.GET("/utilization", h.GetUtilizationStats)
		stats.GET("/peak-valley", h.GetPeakValleyStats)
		stats.GET("/trend", h.GetTrendStats)
		stats.GET("/ranking", h.GetEquipmentRanking)
		stats.GET("/center", h.GetCenterStats)
	}
}

type UtilizationQuery struct {
	Dimension      string `form:"dimension"`
	TimeDimension  string `form:"time_dimension"`
	StartDate      string `form:"start_date"`
	EndDate        string `form:"end_date"`
	CenterID       string `form:"center_id"`
	Category       string `form:"category"`
}

func (h *StatsHandler) GetDashboardStats(c echo.Context) error {
	ctx := c.Request().Context()

	stats, err := h.statsService.GetDashboardStats(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code":    500,
			"message": "获取仪表盘数据失败",
			"error":   err.Error(),
		})
	}

	result := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"series": []map[string]interface{}{
				{
					"name":  "设备总数",
					"value": stats.TotalEquipment,
					"type":  "card",
				},
				{
					"name":  "今日预约",
					"value": stats.TodayBookings,
					"type":  "card",
				},
				{
					"name":  "本月利用率",
					"value": stats.MonthlyUtilization,
					"unit":  "%",
					"type":  "card",
				},
				{
					"name":  "待处理",
					"value": stats.PendingCount,
					"type":  "card",
				},
			},
		},
	}

	return c.JSON(http.StatusOK, result)
}

func (h *StatsHandler) GetUtilizationStats(c echo.Context) error {
	ctx := c.Request().Context()

	var query UtilizationQuery
	if err := c.Bind(&query); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"code":    400,
			"message": "参数错误",
			"error":   err.Error(),
		})
	}

	startDate, endDate, err := parseDateRange(query.StartDate, query.EndDate)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"code":    400,
			"message": "日期格式错误，应为 YYYY-MM-DD",
			"error":   err.Error(),
		})
	}

	req := &service.UtilizationStatsRequest{
		AggregateBy: query.Dimension,
		StartTime:   startDate,
		EndTime:     endDate,
		Dimension:   query.TimeDimension,
	}

	if query.CenterID != "" {
		if centerID, err := strconv.ParseUint(query.CenterID, 10, 64); err == nil {
			req.CenterID = &centerID
		}
	}

	data, err := h.statsService.GetUtilizationStats(ctx, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code":    500,
			"message": "获取利用率统计失败",
			"error":   err.Error(),
		})
	}

	result := h.formatUtilizationForECharts(data, query.Dimension)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code": 200,
		"data": result,
	})
}

func (h *StatsHandler) formatUtilizationForECharts(data interface{}, dimension string) map[string]interface{} {
	result := map[string]interface{}{
		"tooltip": map[string]interface{}{
			"trigger": "axis",
		},
		"legend": map[string]interface{}{
			"data": []string{"利用率", "预约时长"},
		},
		"xAxis": map[string]interface{}{
			"type": "category",
			"data": []string{},
		},
		"yAxis": []map[string]interface{}{
			{
				"type": "value",
				"name": "利用率",
				"axisLabel": map[string]interface{}{
					"formatter": "{value}%",
				},
			},
			{
				"type": "value",
				"name": "预约时长",
				"axisLabel": map[string]interface{}{
					"formatter": "{value}h",
				},
			},
		},
		"series": []map[string]interface{}{
			{
				"name": "利用率",
				"type": "bar",
				"data": []interface{}{},
			},
			{
				"name": "预约时长",
				"type": "line",
				"yAxisIndex": 1,
				"data": []interface{}{},
			},
		},
	}

	xAxisData := make([]string, 0)
	utilizationData := make([]float64, 0)
	bookedHoursData := make([]float64, 0)

	switch v := data.(type) {
	case []model.UtilizationStats:
		for _, item := range v {
			name := item.EquipmentName
			if dimension == "center" {
				name = item.CenterName
			} else if dimension == "time" {
				name = item.Period
			}
			xAxisData = append(xAxisData, name)
			utilizationData = append(utilizationData, item.UtilizationRate)
			bookedHoursData = append(bookedHoursData, item.BookedHours)
		}
	case []model.CenterStats:
		for _, item := range v {
			xAxisData = append(xAxisData, item.CenterName)
			utilizationData = append(utilizationData, item.UtilizationRate)
			bookedHoursData = append(bookedHoursData, item.BookedHours)
		}
	case []model.CategoryStats:
		for _, item := range v {
			xAxisData = append(xAxisData, item.Category)
			utilizationData = append(utilizationData, item.UtilizationRate)
			bookedHoursData = append(bookedHoursData, item.BookedHours)
		}
	}

	result["xAxis"].(map[string]interface{})["data"] = xAxisData
	result["series"].([]map[string]interface{})[0]["data"] = utilizationData
	result["series"].([]map[string]interface{})[1]["data"] = bookedHoursData

	return result
}

func (h *StatsHandler) GetPeakValleyStats(c echo.Context) error {
	ctx := c.Request().Context()

	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")

	start, end, err := parseDateRange(startDate, endDate)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"code":    400,
			"message": "日期格式错误，应为 YYYY-MM-DD",
			"error":   err.Error(),
		})
	}

	stats, err := h.statsService.GetPeakValleyStats(ctx, start, end)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code":    500,
			"message": "获取峰谷分布统计失败",
			"error":   err.Error(),
		})
	}

	hourData := make([]int, 24)
	countData := make([]int64, 24)

	for i := 0; i < 24; i++ {
		hourData[i] = i
		countData[i] = 0
	}

	for _, item := range stats {
		if item.Hour >= 0 && item.Hour < 24 {
			countData[item.Hour] = item.BookingCount
		}
	}

	result := map[string]interface{}{
		"tooltip": map[string]interface{}{
			"trigger": "axis",
		},
		"xAxis": map[string]interface{}{
			"type": "category",
			"data": hourData,
			"axisLabel": map[string]interface{}{
				"formatter": "{value}:00",
			},
		},
		"yAxis": map[string]interface{}{
			"type": "value",
			"name": "预约次数",
		},
		"series": []map[string]interface{}{
			{
				"name": "预约次数",
				"type": "line",
				"smooth": true,
				"areaStyle": map[string]interface{}{},
				"data": countData,
			},
		},
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code": 200,
		"data": result,
	})
}

func (h *StatsHandler) GetTrendStats(c echo.Context) error {
	ctx := c.Request().Context()

	daysStr := c.QueryParam("days")
	days := 7
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && (d == 7 || d == 30 || d == 90) {
			days = d
		}
	}

	req := &service.TrendStatsRequest{
		Days: days,
	}

	stats, err := h.statsService.GetTrendStats(ctx, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code":    500,
			"message": "获取趋势数据失败",
			"error":   err.Error(),
		})
	}

	dates := make([]string, 0, len(stats))
	utilizationRates := make([]float64, 0, len(stats))
	bookedHours := make([]float64, 0, len(stats))

	for _, item := range stats {
		dates = append(dates, item.Date)
		utilizationRates = append(utilizationRates, item.UtilizationRate)
		bookedHours = append(bookedHours, item.BookedHours)
	}

	result := map[string]interface{}{
		"tooltip": map[string]interface{}{
			"trigger": "axis",
		},
		"legend": map[string]interface{}{
			"data": []string{"利用率", "预约时长"},
		},
		"xAxis": map[string]interface{}{
			"type": "category",
			"data": dates,
		},
		"yAxis": []map[string]interface{}{
			{
				"type": "value",
				"name": "利用率",
				"axisLabel": map[string]interface{}{
					"formatter": "{value}%",
				},
			},
			{
				"type": "value",
				"name": "预约时长",
				"axisLabel": map[string]interface{}{
					"formatter": "{value}h",
				},
			},
		},
		"series": []map[string]interface{}{
			{
				"name": "利用率",
				"type": "line",
				"smooth": true,
				"data": utilizationRates,
			},
			{
				"name": "预约时长",
				"type": "bar",
				"yAxisIndex": 1,
				"data": bookedHours,
			},
		},
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code": 200,
		"data": result,
	})
}

func (h *StatsHandler) GetEquipmentRanking(c echo.Context) error {
	ctx := c.Request().Context()

	limitStr := c.QueryParam("limit")
	limit := 10
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")

	start, end, err := parseDateRange(startDate, endDate)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"code":    400,
			"message": "日期格式错误，应为 YYYY-MM-DD",
			"error":   err.Error(),
		})
	}

	req := &service.EquipmentRankingRequest{
		StartTime: start,
		EndTime:   end,
		Limit:     limit,
	}

	stats, err := h.statsService.GetEquipmentRanking(ctx, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code":    500,
			"message": "获取设备利用率排名失败",
			"error":   err.Error(),
		})
	}

	names := make([]string, 0, len(stats))
	utilizationRates := make([]float64, 0, len(stats))
	bookedHours := make([]float64, 0, len(stats))

	for _, item := range stats {
		names = append(names, item.EquipmentName)
		utilizationRates = append(utilizationRates, item.UtilizationRate)
		bookedHours = append(bookedHours, item.BookedHours)
	}

	result := map[string]interface{}{
		"tooltip": map[string]interface{}{
			"trigger": "axis",
		},
		"legend": map[string]interface{}{
			"data": []string{"利用率", "预约时长"},
		},
		"grid": map[string]interface{}{
			"containLabel": true,
		},
		"xAxis": map[string]interface{}{
			"type": "value",
			"name": "利用率",
			"axisLabel": map[string]interface{}{
				"formatter": "{value}%",
			},
		},
		"yAxis": map[string]interface{}{
			"type": "category",
			"data": names,
		},
		"series": []map[string]interface{}{
			{
				"name": "利用率",
				"type": "bar",
				"orientation": "horizontal",
				"data": utilizationRates,
			},
			{
				"name": "预约时长",
				"type": "bar",
				"orientation": "horizontal",
				"data": bookedHours,
			},
		},
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code": 200,
		"data": result,
	})
}

func (h *StatsHandler) GetCenterStats(c echo.Context) error {
	ctx := c.Request().Context()

	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")

	start, end, err := parseDateRange(startDate, endDate)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"code":    400,
			"message": "日期格式错误，应为 YYYY-MM-DD",
			"error":   err.Error(),
		})
	}

	stats, err := h.statsService.GetCenterStats(ctx, start, end)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"code":    500,
			"message": "获取各中心统计失败",
			"error":   err.Error(),
		})
	}

	names := make([]string, 0, len(stats))
	equipmentCounts := make([]int64, 0, len(stats))
	avgUtilizations := make([]float64, 0, len(stats))
	totalBookedHours := make([]float64, 0, len(stats))

	for _, item := range stats {
		names = append(names, item.CenterName)
		equipmentCounts = append(equipmentCounts, item.EquipmentCount)
		avgUtilizations = append(avgUtilizations, item.AvgUtilization)
		totalBookedHours = append(totalBookedHours, item.TotalBookedHours)
	}

	result := map[string]interface{}{
		"tooltip": map[string]interface{}{
			"trigger": "axis",
		},
		"legend": map[string]interface{}{
			"data": []string{"设备数量", "平均利用率", "总预约时长"},
		},
		"xAxis": map[string]interface{}{
			"type": "category",
			"data": names,
		},
		"yAxis": []map[string]interface{}{
			{
				"type": "value",
				"name": "数量",
			},
			{
				"type": "value",
				"name": "利用率",
				"axisLabel": map[string]interface{}{
					"formatter": "{value}%",
				},
			},
			{
				"type": "value",
				"name": "时长",
				"axisLabel": map[string]interface{}{
					"formatter": "{value}h",
				},
			},
		},
		"series": []map[string]interface{}{
			{
				"name": "设备数量",
				"type": "bar",
				"data": equipmentCounts,
			},
			{
				"name": "平均利用率",
				"type": "line",
				"yAxisIndex": 1,
				"data": avgUtilizations,
			},
			{
				"name": "总预约时长",
				"type": "line",
				"yAxisIndex": 2,
				"data": totalBookedHours,
			},
		},
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code": 200,
		"data": result,
	})
}

func parseDateRange(startDate, endDate string) (time.Time, time.Time, error) {
	now := time.Now()

	if startDate == "" {
		startDate = now.AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = now.Format("2006-01-02")
	}

	start, err := time.ParseInLocation("2006-01-02", startDate, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	end, err := time.ParseInLocation("2006-01-02", endDate, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	end = end.Add(24 * time.Hour).Add(-time.Second)

	return start, end, nil
}

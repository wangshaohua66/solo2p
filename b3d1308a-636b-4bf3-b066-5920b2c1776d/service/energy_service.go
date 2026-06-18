package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type EnergyService struct {
	db             *gorm.DB
	energyRepo     *repository.EnergyRepo
	deviceRepo     *repository.DeviceRepo
	inspectionRepo *repository.InspectionRepo
	areaRepo       *repository.AreaRepo
}

func NewEnergyService(db *gorm.DB,
	energyRepo *repository.EnergyRepo,
	deviceRepo *repository.DeviceRepo,
	inspectionRepo *repository.InspectionRepo,
	areaRepo *repository.AreaRepo) *EnergyService {
	return &EnergyService{
		db:             db,
		energyRepo:     energyRepo,
		deviceRepo:     deviceRepo,
		inspectionRepo: inspectionRepo,
		areaRepo:       areaRepo,
	}
}

type EnergyStatsRequest struct {
	AreaID     int64     `json:"area_id"`
	DeviceID   int64     `json:"device_id"`
	DeviceType string    `json:"device_type"`
	Dimension  string    `json:"dimension"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
}

type EnergyStatItem struct {
	Date        string  `json:"date"`
	EnergyUsage float64 `json:"energy_usage"`
	LightHours  float64 `json:"light_hours"`
	DeviceCount int     `json:"device_count"`
}

type EnergyStatsResponse struct {
	TotalEnergy    float64          `json:"total_energy"`
	TotalHours     float64          `json:"total_hours"`
	AvgDailyEnergy float64          `json:"avg_daily_energy"`
	Data           []EnergyStatItem `json:"data"`
}

func (s *EnergyService) GetEnergyStats(ctx context.Context, req *EnergyStatsRequest, areaIDs []int64) (*EnergyStatsResponse, error) {
	params := &repository.EnergyQueryParams{
		AreaID:     req.AreaID,
		DeviceID:   req.DeviceID,
		DeviceType: req.DeviceType,
		Dimension:  req.Dimension,
		StartDate:  req.StartDate,
		EndDate:    req.EndDate,
	}

	rawData, err := s.energyRepo.GetEnergyStats(ctx, params, areaIDs)
	if err != nil {
		return nil, err
	}

	data := make([]EnergyStatItem, 0, len(rawData))
	var totalEnergy, totalHours float64
	for _, r := range rawData {
		data = append(data, EnergyStatItem{
			Date:        r.Date.Format("2006-01-02"),
			EnergyUsage: roundFloat(r.EnergyUsage, 2),
			LightHours:  roundFloat(r.LightHours, 2),
			DeviceCount: r.DeviceCount,
		})
		totalEnergy += r.EnergyUsage
		totalHours += r.LightHours
	}

	days := len(data)
	if days == 0 {
		days = 1
	}
	avgDaily := totalEnergy / float64(days)

	return &EnergyStatsResponse{
		TotalEnergy:    roundFloat(totalEnergy, 2),
		TotalHours:     roundFloat(totalHours, 2),
		AvgDailyEnergy: roundFloat(avgDaily, 2),
		Data:           data,
	}, nil
}

type YoYComparisonResponse struct {
	CurrentPeriod  EnergyPeriodData `json:"current_period"`
	PreviousPeriod EnergyPeriodData `json:"previous_period"`
	ChangeRate     float64          `json:"change_rate"`
	ChangeAmount   float64          `json:"change_amount"`
}

type EnergyPeriodData struct {
	StartDate   string  `json:"start_date"`
	EndDate     string  `json:"end_date"`
	TotalEnergy float64 `json:"total_energy"`
}

func (s *EnergyService) GetYearOverYearComparison(ctx context.Context, areaID int64, start, end time.Time, areaIDs []int64) (*YoYComparisonResponse, error) {
	compareResult, err := s.energyRepo.CompareYearOverYear(ctx, areaID, start, end)
	if err != nil {
		return nil, err
	}

	prevStart := start.AddDate(-1, 0, 0)
	prevEnd := end.AddDate(-1, 0, 0)

	return &YoYComparisonResponse{
		CurrentPeriod: EnergyPeriodData{
			StartDate:   start.Format("2006-01-02"),
			EndDate:     end.Format("2006-01-02"),
			TotalEnergy: roundFloat(compareResult["current"], 2),
		},
		PreviousPeriod: EnergyPeriodData{
			StartDate:   prevStart.Format("2006-01-02"),
			EndDate:     prevEnd.Format("2006-01-02"),
			TotalEnergy: roundFloat(compareResult["previous"], 2),
		},
		ChangeRate:   roundFloat(compareResult["change_rate"], 2),
		ChangeAmount: roundFloat(compareResult["current"]-compareResult["previous"], 2),
	}, nil
}

type OptimizationSuggestion struct {
	Type        string  `json:"type"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	PotentialSave float64 `json:"potential_save"`
	Confidence  float64 `json:"confidence"`
}

type OptimizationReport struct {
	TotalUsage      float64                  `json:"total_usage"`
	BenchmarkUsage  float64                  `json:"benchmark_usage"`
	ExpectedSave    float64                  `json:"expected_save"`
	Suggestions     []OptimizationSuggestion `json:"suggestions"`
	AbnormalDevices int                      `json:"abnormal_devices"`
}

func (s *EnergyService) GetOptimizationReport(ctx context.Context, areaID int64, areaIDs []int64) (*OptimizationReport, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	totalUsage, err := s.energyRepo.GetAreaTotalEnergy(ctx, areaID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	var allAreaIDs []int64
	if areaID > 0 {
		ids, err := s.areaRepo.GetSubAreaIDs(ctx, areaID)
		if err == nil {
			allAreaIDs = ids
		} else {
			allAreaIDs = []int64{areaID}
		}
	} else if len(areaIDs) > 0 {
		allAreaIDs = areaIDs
	}

	totalDevices := 0
	for _, aid := range allAreaIDs {
		c, _ := s.deviceRepo.CountByArea(ctx, aid)
		totalDevices += int(c)
	}

	benchmarkPerDevice := 2.5
	benchmarkUsage := float64(totalDevices) * benchmarkPerDevice * 30

	var suggestions []OptimizationSuggestion

	abnormalDevices, err := s.energyRepo.GetTopAbnormalDevices(ctx, allAreaIDs, 20)
	if err != nil {
		pkg.Warn(ctx, "failed to get abnormal devices", zap.Error(err))
	}

	if len(abnormalDevices) > 0 {
		potentialSave := float64(len(abnormalDevices)) * 0.5 * 30
		suggestions = append(suggestions, OptimizationSuggestion{
			Type:        "device",
			Title:       fmt.Sprintf("检修高耗电设备"),
			Description: fmt.Sprintf("发现 %d 台设备能耗异常偏高，建议优先检修排查", len(abnormalDevices)),
			PotentialSave: roundFloat(potentialSave, 2),
			Confidence:  0.85,
		})
	}

	yoy, _ := s.energyRepo.CompareYearOverYear(ctx, areaID, startDate, endDate)
	if yoy["change_rate"] > 10 {
		suggestions = append(suggestions, OptimizationSuggestion{
			Type:        "analysis",
			Title:       "能耗异常增长",
			Description: fmt.Sprintf("本月能耗较去年同期增长 %.1f%%，建议重点关注", yoy["change_rate"]),
			PotentialSave: roundFloat(yoy["current"]-yoy["previous"], 2),
			Confidence:  0.9,
		})
	}

	hpsDevices, _ := s.deviceRepo.List(ctx, &repository.DeviceQueryParams{
		DeviceType: model.DeviceTypeHPS,
		PageSize:   1,
	}, allAreaIDs)
	if hpsDevices != nil && len(hpsDevices) > 0 {
		cnt := 0
		q := s.db.Model(&model.Device{}).Where("device_type = ?", model.DeviceTypeHPS)
		if len(allAreaIDs) > 0 {
			q = q.Where("area_id IN ?", allAreaIDs)
		}
		var count int64
		_ = q.Count(&count).Error
		cnt = int(count)

		ledSaving := float64(cnt) * 1.5 * 30
		suggestions = append(suggestions, OptimizationSuggestion{
			Type:        "upgrade",
			Title:       "高压钠灯改造为LED",
			Description: fmt.Sprintf("建议将 %d 盏高压钠灯替换为LED，预计节能60%%以上", cnt),
			PotentialSave: roundFloat(ledSaving, 2),
			Confidence:  0.95,
		})
	}

	suggestions = append(suggestions, OptimizationSuggestion{
		Type:        "schedule",
		Title:       "优化开关灯时间策略",
		Description: "建议根据日出日落时间动态调整开关灯时间，避免过早开灯或过晚关灯",
		PotentialSave: roundFloat(totalUsage*0.05, 2),
		Confidence:  0.8,
	})

	suggestions = append(suggestions, OptimizationSuggestion{
		Type:        "dimming",
		Title:       "分时段亮度调节",
		Description: "建议在23:00-05:00时段降低路灯亮度至70%，可显著降低能耗",
		PotentialSave: roundFloat(totalUsage*0.12, 2),
		Confidence:  0.85,
	})

	expectedSave := 0.0
	for _, s := range suggestions {
		expectedSave += s.PotentialSave * s.Confidence
	}

	return &OptimizationReport{
		TotalUsage:      roundFloat(totalUsage, 2),
		BenchmarkUsage:  roundFloat(benchmarkUsage, 2),
		ExpectedSave:    roundFloat(expectedSave, 2),
		Suggestions:     suggestions,
		AbnormalDevices: len(abnormalDevices),
	}, nil
}

type AbnormalDeviceResponse struct {
	DeviceID      int64   `json:"device_id"`
	DeviceCode    string  `json:"device_code"`
	DeviceName    string  `json:"device_name"`
	AreaID        int64   `json:"area_id"`
	DeviceType    string  `json:"device_type"`
	AvgEnergy     float64 `json:"avg_energy"`
	ExpectedAvg   float64 `json:"expected_avg"`
	AbnormalRate  float64 `json:"abnormal_rate"`
	LastReportAt  string  `json:"last_report_at"`
}

func (s *EnergyService) GetAbnormalDevices(ctx context.Context, areaIDs []int64, limit int) ([]*AbnormalDeviceResponse, error) {
	if limit <= 0 {
		limit = 50
	}
	devices, err := s.energyRepo.GetTopAbnormalDevices(ctx, areaIDs, limit)
	if err != nil {
		return nil, err
	}

	result := make([]*AbnormalDeviceResponse, 0, len(devices))
	for _, d := range devices {
		did, ok := d["device_id"].(int64)
		if !ok {
			continue
		}
		device, err := s.deviceRepo.GetByID(ctx, did)
		if err != nil {
			continue
		}
		avgE, _ := d["avg_energy"].(float64)
		expE, _ := d["expected_avg"].(float64)
		abnR, _ := d["abnormal_rate"].(float64)
		result = append(result, &AbnormalDeviceResponse{
			DeviceID:     device.ID,
			DeviceCode:   device.DeviceCode,
			DeviceName:   device.Name,
			AreaID:       device.AreaID,
			DeviceType:   device.DeviceType,
			AvgEnergy:    roundFloat(avgE, 2),
			ExpectedAvg:  roundFloat(expE, 2),
			AbnormalRate: roundFloat(abnR, 2),
			LastReportAt: device.LastReportAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result, nil
}

func (s *EnergyService) CalculateDailyEnergy(ctx context.Context, date time.Time) error {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.AddDate(0, 0, 1)

	pkg.Info(ctx, fmt.Sprintf("calculating daily energy for %s", startOfDay.Format("2006-01-02")))

	areas, err := s.areaRepo.ListAll(ctx)
	if err != nil {
		return err
	}

	var dailyList []*model.EnergyDaily
	deviceIDs, _ := s.deviceRepo.GetAllIDs(ctx, nil)

	batchSize := 500
	for i := 0; i < len(deviceIDs); i += batchSize {
		end := i + batchSize
		if end > len(deviceIDs) {
			end = len(deviceIDs)
		}
		batch := deviceIDs[i:end]

		type energyResult struct {
			DeviceID    int64   `gorm:"column:device_id"`
			AreaID      int64   `gorm:"column:area_id"`
			DeviceType  string  `gorm:"column:device_type"`
			TotalPower  float64 `gorm:"column:total_power"`
			ReportCount int64   `gorm:"column:report_count"`
			OnCount     int64   `gorm:"column:on_count"`
		}
		var results []energyResult

		err := s.db.Raw(`
			SELECT ds.device_id as device_id, d.area_id as area_id, d.device_type as device_type,
			       SUM(ds.power) as total_power,
			       COUNT(*) as report_count,
			       SUM(CASE WHEN ds.is_on = 1 THEN 1 ELSE 0 END) as on_count
			FROM device_statuses ds
			LEFT JOIN devices d ON d.id = ds.device_id
			WHERE ds.device_id IN ? AND ds.report_time >= ? AND ds.report_time < ?
			GROUP BY ds.device_id
		`, batch, startOfDay, endOfDay).Scan(&results).Error
		if err != nil {
			pkg.Error(ctx, "failed to query energy stats", zap.Error(err))
			continue
		}

		for _, r := range results {
			if r.ReportCount == 0 {
				continue
			}
			energyKWh := (r.TotalPower / 1000) * 0.25
			lightHours := float64(r.OnCount) * 0.25

			dailyList = append(dailyList, &model.EnergyDaily{
				Date:        startOfDay,
				AreaID:      r.AreaID,
				DeviceID:    r.DeviceID,
				DeviceType:  r.DeviceType,
				EnergyUsage: roundFloat(energyKWh, 4),
				LightHours:  roundFloat(lightHours, 2),
				DeviceCount: 1,
				CreatedAt:   time.Now(),
			})
		}
	}

	areaEnergy := make(map[int64]*model.EnergyDaily)
	for _, area := range areas {
		areaEnergy[area.ID] = &model.EnergyDaily{
			Date:     startOfDay,
			AreaID:   area.ID,
			DeviceID: 0,
		}
	}

	for _, d := range dailyList {
		if agg, ok := areaEnergy[d.AreaID]; ok {
			agg.EnergyUsage += d.EnergyUsage
			agg.LightHours += d.LightHours
			agg.DeviceCount++
		}
	}

	for _, agg := range areaEnergy {
		if agg.DeviceCount > 0 {
			agg.EnergyUsage = roundFloat(agg.EnergyUsage, 2)
			agg.LightHours = roundFloat(agg.LightHours, 2)
			agg.CreatedAt = time.Now()
			dailyList = append(dailyList, agg)
		}
	}

	if err := s.energyRepo.BatchInsertDaily(ctx, dailyList); err != nil {
		return err
	}

	pkg.Info(ctx, fmt.Sprintf("energy calculation completed: %d records inserted", len(dailyList)))
	return nil
}

func roundFloat(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}

type StatsService struct {
	db            *gorm.DB
	deviceRepo    *repository.DeviceRepo
	faultRepo     *repository.FaultRepo
	workOrderRepo *repository.WorkOrderRepo
	energyRepo    *repository.EnergyRepo
	areaRepo      *repository.AreaRepo
}

func NewStatsService(db *gorm.DB,
	deviceRepo *repository.DeviceRepo,
	faultRepo *repository.FaultRepo,
	workOrderRepo *repository.WorkOrderRepo,
	energyRepo *repository.EnergyRepo,
	areaRepo *repository.AreaRepo) *StatsService {
	return &StatsService{
		db:            db,
		deviceRepo:    deviceRepo,
		faultRepo:     faultRepo,
		workOrderRepo: workOrderRepo,
		energyRepo:    energyRepo,
		areaRepo:      areaRepo,
	}
}

type OverviewStats struct {
	TotalDevices       int64   `json:"total_devices"`
	OnlineDevices      int64   `json:"online_devices"`
	OfflineDevices     int64   `json:"offline_devices"`
	FaultDevices       int64   `json:"fault_devices"`
	LightingRate       float64 `json:"lighting_rate"`
	PendingFaults      int64   `json:"pending_faults"`
	PendingWorkOrders  int64   `json:"pending_work_orders"`
	CompletedWorkOrder int64   `json:"completed_work_orders"`
	WorkOrderRate      float64 `json:"work_order_rate"`
	AvgResponseTime    float64 `json:"avg_response_time"`
	TodayEnergy        float64 `json:"today_energy"`
	MonthEnergy        float64 `json:"month_energy"`
}

func (s *StatsService) GetOverviewStats(ctx context.Context, areaIDs []int64) (*OverviewStats, error) {
	stats := &OverviewStats{}

	type devResult struct {
		Status string `gorm:"column:status"`
		IsOn   bool   `gorm:"column:is_on"`
		Count  int64  `gorm:"column:count"`
	}
	var devResults []devResult
	q := s.db.Model(&model.Device{}).Select("status, is_on, COUNT(*) as count")
	if len(areaIDs) > 0 {
		q = q.Where("area_id IN ?", areaIDs)
	}
	_ = q.Group("status, is_on").Scan(&devResults).Error

	var total, online, offline, fault, onCount int64
	for _, r := range devResults {
		total += r.Count
		switch r.Status {
		case model.DeviceStatusOnline:
			online += r.Count
		case model.DeviceStatusOffline:
			offline += r.Count
		case model.DeviceStatusFault:
			fault += r.Count
		}
		if r.IsOn {
			onCount += r.Count
		}
	}
	stats.TotalDevices = total
	stats.OnlineDevices = online
	stats.OfflineDevices = offline
	stats.FaultDevices = fault
	if total > 0 {
		stats.LightingRate = roundFloat(float64(onCount)/float64(total)*100, 2)
	}

	pendingFaults, _ := s.faultRepo.CountByStatus(ctx, model.AlertStatusPending, areaIDs)
	stats.PendingFaults = pendingFaults

	pendingWO, _ := s.workOrderRepo.CountByStatus(ctx, model.WorkOrderStatusCreated, areaIDs)
	acceptedWO, _ := s.workOrderRepo.CountByStatus(ctx, model.WorkOrderStatusAccepted, areaIDs)
	processingWO, _ := s.workOrderRepo.CountByStatus(ctx, model.WorkOrderStatusProcessing, areaIDs)
	reviewingWO, _ := s.workOrderRepo.CountByStatus(ctx, model.WorkOrderStatusReviewing, areaIDs)
	completedWO, _ := s.workOrderRepo.CountByStatus(ctx, model.WorkOrderStatusCompleted, areaIDs)
	stats.PendingWorkOrders = pendingWO + acceptedWO + processingWO + reviewingWO
	stats.CompletedWorkOrder = completedWO

	totalWO := stats.PendingWorkOrders + completedWO
	if totalWO > 0 {
		stats.WorkOrderRate = roundFloat(float64(completedWO)/float64(totalWO)*100, 2)
	}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	areaID := int64(0)
	if len(areaIDs) > 0 {
		areaID = areaIDs[0]
	}
	todayE, _ := s.energyRepo.GetAreaTotalEnergy(ctx, areaID, todayStart, now)
	monthE, _ := s.energyRepo.GetAreaTotalEnergy(ctx, areaID, monthStart, now)
	stats.TodayEnergy = roundFloat(todayE, 2)
	stats.MonthEnergy = roundFloat(monthE, 2)

	type avgResult struct {
		AvgResponse float64 `gorm:"column:avg_response"`
	}
	var avgRes avgResult
	q2 := s.db.Model(&model.WorkOrder{}).Select("AVG(response_time) as avg_response")
	if len(areaIDs) > 0 {
		q2 = q2.Where("area_id IN ?", areaIDs)
	}
	_ = q2.Where("response_time > 0").Scan(&avgRes).Error
	stats.AvgResponseTime = roundFloat(avgRes.AvgResponse/60, 2)

	return stats, nil
}

type TrendData struct {
	Date   string  `json:"date"`
	Value  float64 `json:"value"`
	Value2 float64 `json:"value2,omitempty"`
}

func (s *StatsService) GetLightingRateTrend(ctx context.Context, areaIDs []int64, days int) ([]TrendData, error) {
	if days <= 0 {
		days = 30
	}
	result := make([]TrendData, 0, days)
	now := time.Now()
	for i := days - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		dateStr := d.Format("01-02")
		online, _ := s.deviceRepo.CountByStatus(ctx, model.DeviceStatusOnline, areaIDs)
		total, _ := s.deviceRepo.GetAllIDs(ctx, areaIDs)
		rate := 0.0
		if len(total) > 0 {
			rate = roundFloat(float64(online)/float64(len(total))*100, 2)
		}
		result = append(result, TrendData{Date: dateStr, Value: rate})
	}
	return result, nil
}

func (s *StatsService) GetEnergyTrend(ctx context.Context, areaIDs []int64, days int) ([]TrendData, error) {
	if days <= 0 {
		days = 30
	}
	now := time.Now()
	startDate := now.AddDate(0, 0, -days)
	endDate := now

	areaID := int64(0)
	if len(areaIDs) > 0 {
		areaID = areaIDs[0]
	}

	params := &repository.EnergyQueryParams{
		AreaID:    areaID,
		StartDate: startDate,
		EndDate:   endDate,
	}

	data, err := s.energyRepo.GetEnergyStats(ctx, params, areaIDs)
	if err != nil {
		return nil, err
	}
	result := make([]TrendData, 0, len(data))
	for _, d := range data {
		result = append(result, TrendData{
			Date:  d.Date.Format("01-02"),
			Value: roundFloat(d.EnergyUsage, 2),
		})
	}
	return result, nil
}

func (s *StatsService) GetFaultTypeDistribution(ctx context.Context, areaIDs []int64) (map[string]int64, error) {
	return s.faultRepo.CountByFaultType(ctx, areaIDs)
}

type AreaRankingItem struct {
	AreaID     int64   `json:"area_id"`
	AreaName   string  `json:"area_name"`
	Total      int64   `json:"total"`
	Online     int64   `json:"online"`
	LightRate  float64 `json:"light_rate"`
	Energy     float64 `json:"energy"`
	FaultCount int64   `json:"fault_count"`
}

func (s *StatsService) GetAreaRanking(ctx context.Context, areaIDs []int64) ([]AreaRankingItem, error) {
	areas, err := s.areaRepo.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	var result []AreaRankingItem
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	for _, area := range areas {
		ids := []int64{area.ID}
		total, _ := s.deviceRepo.CountByArea(ctx, area.ID)
		online, _ := s.deviceRepo.CountByStatus(ctx, model.DeviceStatusOnline, ids)
		lightRate := 0.0
		if total > 0 {
			lightRate = roundFloat(float64(online)/float64(total)*100, 2)
		}
		energy, _ := s.energyRepo.GetAreaTotalEnergy(ctx, area.ID, monthStart, now)
		faultCount, _ := s.faultRepo.CountByStatus(ctx, model.AlertStatusPending, ids)

		result = append(result, AreaRankingItem{
			AreaID:     area.ID,
			AreaName:   area.Name,
			Total:      total,
			Online:     online,
			LightRate:  lightRate,
			Energy:     roundFloat(energy, 2),
			FaultCount: faultCount,
		})
	}

	return result, nil
}

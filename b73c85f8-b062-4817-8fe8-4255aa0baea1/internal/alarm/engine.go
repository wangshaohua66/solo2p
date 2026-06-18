package alarm

import (
	"encoding/json"
	"fmt"
	"gas-network-system/internal/config"
	"gas-network-system/internal/model"
	"gas-network-system/internal/repository"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type PressureRule struct {
	ID          string
	Name        string
	Type        model.AlarmType
	Level       model.AlarmLevel
	Condition   func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool
	Description string
}

type VolatilityWindow struct {
	Values    []float64
	Timestamps []time.Time
	MaxSize   int
	mu        sync.Mutex
}

func NewVolatilityWindow(maxSize int) *VolatilityWindow {
	return &VolatilityWindow{
		Values:     make([]float64, 0, maxSize),
		Timestamps: make([]time.Time, 0, maxSize),
		MaxSize:    maxSize,
	}
}

func (w *VolatilityWindow) Add(value float64, timestamp time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.Values = append(w.Values, value)
	w.Timestamps = append(w.Timestamps, timestamp)

	if len(w.Values) > w.MaxSize {
		w.Values = w.Values[1:]
		w.Timestamps = w.Timestamps[1:]
	}
}

func (w *VolatilityWindow) BatchRestore(values []float64, timestamps []time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()

	n := len(values)
	if n > w.MaxSize {
		values = values[n-w.MaxSize:]
		timestamps = timestamps[n-w.MaxSize:]
	}
	w.Values = append([]float64{}, values...)
	w.Timestamps = append([]time.Time{}, timestamps...)
}

func (w *VolatilityWindow) Snapshot() ([]float64, []time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()
	vs := make([]float64, len(w.Values))
	copy(vs, w.Values)
	ts := make([]time.Time, len(w.Timestamps))
	copy(ts, w.Timestamps)
	return vs, ts
}

func (w *VolatilityWindow) CalculateVolatility() float64 {
	w.mu.Lock()
	defer w.mu.Unlock()

	if len(w.Values) < 2 {
		return 0
	}

	minVal := w.Values[0]
	maxVal := w.Values[0]
	for _, v := range w.Values {
		if v < minVal {
			minVal = v
		}
		if v > maxVal {
			maxVal = v
		}
	}

	avg := 0.0
	for _, v := range w.Values {
		avg += v
	}
	avg /= float64(len(w.Values))

	if avg == 0 {
		return 0
	}

	return (maxVal - minVal) / avg
}

func (w *VolatilityWindow) GetValues() []float64 {
	w.mu.Lock()
	defer w.mu.Unlock()
	values := make([]float64, len(w.Values))
	copy(values, w.Values)
	return values
}

func (w *VolatilityWindow) ClearOld(cutoffTime time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()

	for len(w.Timestamps) > 0 && w.Timestamps[0].Before(cutoffTime) {
		w.Values = w.Values[1:]
		w.Timestamps = w.Timestamps[1:]
	}
}

type AlarmEngine struct {
	repo       *repository.Repository
	logger     *zap.Logger
	config     *config.Config
	rules      []PressureRule
	volatility map[uint]*VolatilityWindow
	mu         sync.RWMutex
}

func NewAlarmEngine(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *AlarmEngine {
	engine := &AlarmEngine{
		repo:       repo,
		logger:     logger,
		config:     cfg,
		volatility: make(map[uint]*VolatilityWindow),
	}
	engine.initRules()
	engine.LoadVolatilityFromDB()
	return engine
}

func (e *AlarmEngine) initRules() {
	e.rules = []PressureRule{
		{
			ID:   "PRESSURE_HIGH_CRITICAL",
			Name: "压力超高-严重",
			Type: model.AlarmTypePressureHigh,
			Level: model.AlarmLevelCritical,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure > station.MaxPressure*1.2
			},
			Description: "压力超过上限20%",
		},
		{
			ID:   "PRESSURE_HIGH_MAJOR",
			Name: "压力超高-重大",
			Type: model.AlarmTypePressureHigh,
			Level: model.AlarmLevelMajor,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure > station.MaxPressure*1.1 && pressure <= station.MaxPressure*1.2
			},
			Description: "压力超过上限10%-20%",
		},
		{
			ID:   "PRESSURE_HIGH_WARNING",
			Name: "压力超高-警告",
			Type: model.AlarmTypePressureHigh,
			Level: model.AlarmLevelWarning,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure > station.MaxPressure && pressure <= station.MaxPressure*1.1
			},
			Description: "压力超过上限0%-10%",
		},
		{
			ID:   "PRESSURE_LOW_CRITICAL",
			Name: "压力过低-严重",
			Type: model.AlarmTypePressureLow,
			Level: model.AlarmLevelCritical,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure < station.MinPressure*0.8 && pressure > 0
			},
			Description: "压力低于下限20%",
		},
		{
			ID:   "PRESSURE_LOW_MAJOR",
			Name: "压力过低-重大",
			Type: model.AlarmTypePressureLow,
			Level: model.AlarmLevelMajor,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure >= station.MinPressure*0.8 && pressure < station.MinPressure*0.9
			},
			Description: "压力低于下限10%-20%",
		},
		{
			ID:   "PRESSURE_LOW_WARNING",
			Name: "压力过低-警告",
			Type: model.AlarmTypePressureLow,
			Level: model.AlarmLevelWarning,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure >= station.MinPressure*0.9 && pressure < station.MinPressure
			},
			Description: "压力低于下限0%-10%",
		},
		{
			ID:   "PRESSURE_LEAKAGE",
			Name: "疑似泄漏",
			Type: model.AlarmTypeLeakage,
			Level: model.AlarmLevelMajor,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return pressure <= 0 || (pressure < station.MinPressure*0.5 && pressure > 0)
			},
			Description: "压力骤降或接近0，疑似泄漏",
		},
		{
			ID:   "VOLATILITY_HIGH",
			Name: "压力波动异常",
			Type: model.AlarmTypeVolatility,
			Level: model.AlarmLevelWarning,
			Condition: func(station *model.PressureRegulatingStation, pressure float64, volatility float64) bool {
				return volatility > 0.15
			},
			Description: "1小时内压力波动率超过15%",
		},
	}
}

func (e *AlarmEngine) LoadVolatilityFromDB() {
	since := time.Now().Add(-2 * time.Hour)
	stationIDs, err := e.repo.Pressure.GetAllStationsWithVolatility()
	if err != nil {
		e.logger.Warn("加载波动率窗口失败：获取站列表出错", zap.Error(err))
		return
	}

	totalLoaded := 0
	for _, sid := range stationIDs {
		points, err := e.repo.Pressure.GetVolatilityPoints(sid, since, 12)
		if err != nil {
			e.logger.Warn("加载波动率窗口失败",
				zap.Uint("station_id", sid),
				zap.Error(err))
			continue
		}
		if len(points) == 0 {
			continue
		}
		values := make([]float64, len(points))
		timestamps := make([]time.Time, len(points))
		for i, p := range points {
			values[i] = p.PressureValue
			timestamps[i] = p.Timestamp
		}
		window := NewVolatilityWindow(12)
		window.BatchRestore(values, timestamps)
		e.mu.Lock()
		e.volatility[sid] = window
		e.mu.Unlock()
		totalLoaded += len(points)
	}

	if totalLoaded > 0 {
		e.logger.Info("波动率窗口已从数据库恢复",
			zap.Int("stations_count", len(stationIDs)),
			zap.Int("points_loaded", totalLoaded),
			zap.Duration("window_size", 2*time.Hour))
	}

	deleted, err := e.repo.Pressure.CleanVolatilityPoints(since.Add(-1 * time.Hour))
	if err != nil {
		e.logger.Warn("清理过期波动率点失败", zap.Error(err))
	} else if deleted > 0 {
		e.logger.Info("已清理过期波动率点", zap.Int64("deleted", deleted))
	}
}

func (e *AlarmEngine) getVolatilityWindow(stationID uint) *VolatilityWindow {
	e.mu.RLock()
	window, exists := e.volatility[stationID]
	e.mu.RUnlock()

	if !exists {
		e.mu.Lock()
		window, exists = e.volatility[stationID]
		if !exists {
			window = NewVolatilityWindow(12)
			e.volatility[stationID] = window
		}
		e.mu.Unlock()
	}

	return window
}

type PressureDataInput struct {
	StationID     uint      `json:"station_id" binding:"required"`
	PressureValue float64   `json:"pressure_value" binding:"required,gte=0"`
	Timestamp     time.Time `json:"timestamp"`
}

type MatchResult struct {
	Matched    bool
	Rule       *PressureRule
	Volatility float64
	Alarm      *model.Alarm
}

func (e *AlarmEngine) ProcessPressureData(input PressureDataInput) ([]MatchResult, error) {
	if input.Timestamp.IsZero() {
		input.Timestamp = time.Now()
	}

	station, err := e.repo.Pressure.GetStationByID(input.StationID)
	if err != nil {
		e.logger.Error("获取调压站信息失败", zap.Uint("station_id", input.StationID), zap.Error(err))
		return nil, fmt.Errorf("调压站不存在: %w", err)
	}

	window := e.getVolatilityWindow(input.StationID)
	window.ClearOld(time.Now().Add(-1 * time.Hour))
	window.Add(input.PressureValue, input.Timestamp)
	volatility := window.CalculateVolatility()

	if err := e.repo.Pressure.SaveVolatilityPoint(
		input.StationID, input.PressureValue, input.Timestamp,
	); err != nil {
		e.logger.Warn("持久化波动率点失败",
			zap.Uint("station_id", input.StationID),
			zap.Error(err))
	}

	pressureData := &model.PressureData{
		StationID:     input.StationID,
		PressureValue: input.PressureValue,
		Timestamp:     input.Timestamp,
		IsArchived:    false,
	}

	if err := e.repo.Pressure.CreateData(pressureData); err != nil {
		e.logger.Error("保存压力数据失败", zap.Error(err))
		return nil, err
	}

	var results []MatchResult
	for _, rule := range e.rules {
		if rule.Condition(station, input.PressureValue, volatility) {
			alarm, err := e.createAlarm(station, pressureData, rule, volatility)
			if err != nil {
				e.logger.Error("创建告警失败", zap.String("rule_id", rule.ID), zap.Error(err))
				continue
			}
			results = append(results, MatchResult{
				Matched:    true,
				Rule:       &rule,
				Volatility: volatility,
				Alarm:      alarm,
			})
			e.logger.Info("压力告警生成",
				zap.String("rule", rule.Name),
				zap.Uint("station", station.ID),
				zap.Float64("pressure", input.PressureValue),
				zap.Float64("volatility", volatility),
			)
		}
	}

	return results, nil
}

func (e *AlarmEngine) createAlarm(station *model.PressureRegulatingStation, pressureData *model.PressureData, rule PressureRule, volatility float64) (*model.Alarm, error) {
	alarmNo := fmt.Sprintf("ALM-%s", uuid.New().String()[:8])

	pipelineID := uint(1)
	pipelines, _ := e.repo.Pipeline.GetAllPipelines()
	for _, p := range pipelines {
		if p.GateStationID != nil && *p.GateStationID == station.ID {
			pipelineID = p.ID
			break
		}
	}

	desc := fmt.Sprintf("调压站[%s]压力异常。当前压力: %.2f kPa, 阈值范围: [%.2f, %.2f] kPa",
		station.Name, pressureData.PressureValue, station.MinPressure, station.MaxPressure)

	if rule.Type == model.AlarmTypeVolatility {
		desc = fmt.Sprintf("调压站[%s]压力波动异常。波动率: %.2f%%, 阈值: %.2f%%",
			station.Name, volatility*100, e.config.Alarm.VolatilityThreshold*100)
	}

	alarm := &model.Alarm{
		AlarmNo:       alarmNo,
		Type:          rule.Type,
		Level:         rule.Level,
		Status:        model.AlarmStatusNew,
		PipelineID:    pipelineID,
		PressureDataID: &pressureData.ID,
		PressureValue: pressureData.PressureValue,
		Location:      station.Location,
		Description:   desc,
		RuleMatched:   rule.Description,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	err := e.repo.Alarm.Create(alarm)
	if err != nil {
		return nil, err
	}

	e.logOperation(alarm.ID, "ALARM", fmt.Sprintf("生成告警: %s", rule.Name))

	return alarm, nil
}

func (e *AlarmEngine) BatchProcess(dataList []PressureDataInput) ([]MatchResult, error) {
	var allResults []MatchResult
	for _, data := range dataList {
		results, err := e.ProcessPressureData(data)
		if err != nil {
			e.logger.Error("批量处理压力数据失败", zap.Error(err))
			continue
		}
		allResults = append(allResults, results...)
	}
	return allResults, nil
}

func (e *AlarmEngine) CalculateHourlyVolatility(stationID uint, hour time.Time) (float64, error) {
	station, err := e.repo.Pressure.GetStationByID(stationID)
	if err != nil {
		return 0, err
	}

	startTime := time.Date(hour.Year(), hour.Month(), hour.Day(), hour.Hour(), 0, 0, 0, hour.Location())
	endTime := startTime.Add(time.Hour)

	data, err := e.repo.Pressure.GetDataForStats(stationID, startTime, endTime)
	if err != nil {
		return 0, err
	}

	if len(data) < 2 {
		return 0, nil
	}

	var values []float64
	for _, d := range data {
		values = append(values, d.PressureValue)
	}

	minVal := values[0]
	maxVal := values[0]
	for _, v := range values {
		if v < minVal {
			minVal = v
		}
		if v > maxVal {
			maxVal = v
		}
	}

	avg := 0.0
	for _, v := range values {
		avg += v
	}
	avg /= float64(len(values))

	if avg == 0 {
		return 0, nil
	}

	volatility := (maxVal - minVal) / avg

	if volatility > e.config.Alarm.VolatilityThreshold {
		e.logger.Warn("小时波动率超过阈值",
			zap.Uint("station_id", stationID),
			zap.String("station", station.Name),
			zap.Float64("volatility", volatility),
			zap.Float64("threshold", e.config.Alarm.VolatilityThreshold),
		)
	}

	return volatility, nil
}

func (e *AlarmEngine) ArchiveOldData() (int64, error) {
	cutoffDate := time.Now().AddDate(0, 0, -e.config.Pressure.DataRetentionDays)

	sizeBefore, _ := e.repo.Pressure.GetDatabaseSizeMB()

	aggRows, err := e.repo.Pressure.GetDailyAggregationData(cutoffDate)
	if err != nil {
		e.logger.Error("获取归档前日聚合数据失败，中止归档", zap.Error(err))
		return 0, fmt.Errorf("获取聚合数据失败: %w", err)
	}

	statsSaved := 0
	if len(aggRows) > 0 {
		var statsList []model.PressureDailyStats
		for _, row := range aggRows {
			statsDate, parseErr := time.ParseInLocation("2006-01-02", row.StatsDate, time.Local)
			if parseErr != nil {
				e.logger.Warn("解析统计日期失败",
					zap.String("date", row.StatsDate),
					zap.Error(parseErr))
				continue
			}
			volatility := 0.0
			if row.AvgPressure > 0 {
				volatility = (row.MaxPressure - row.MinPressure) / row.AvgPressure
			}
			statsList = append(statsList, model.PressureDailyStats{
				StationID:   row.StationID,
				StatsDate:   statsDate,
				MaxPressure: row.MaxPressure,
				MinPressure: row.MinPressure,
				AvgPressure: row.AvgPressure,
				Volatility:  volatility,
				SampleCount: row.DataCount,
				CreatedAt:   time.Now(),
			})
		}
		if len(statsList) > 0 {
			if saveErr := e.repo.Pressure.BatchCreateDailyStats(statsList); saveErr != nil {
				e.logger.Error("批量保存日统计失败，中止归档以防止数据丢失", zap.Error(saveErr))
				return 0, fmt.Errorf("保存日统计失败: %w", saveErr)
			}
			statsSaved = len(statsList)
			e.logger.Info("归档前日统计已保存",
				zap.Int("stats_count", statsSaved),
				zap.Time("cutoff_date", cutoffDate))
		}
	}

	totalArchived := int64(0)

	for {
		count, err := e.repo.Pressure.ArchiveOldData(cutoffDate, e.config.Pressure.ArchiveBatchSize)
		if err != nil {
			return totalArchived, fmt.Errorf("标记归档失败: %w", err)
		}
		totalArchived += count
		if count == 0 {
			break
		}
	}

	totalDeleted := int64(0)
	for {
		count, err := e.repo.Pressure.DeleteArchivedData(cutoffDate, e.config.Pressure.ArchiveBatchSize)
		if err != nil {
			e.logger.Error("删除已归档数据失败", zap.Error(err))
			break
		}
		totalDeleted += count
		if count == 0 {
			break
		}
	}

	if totalDeleted > 0 {
		if vacuumErr := e.repo.Pressure.Vacuum(); vacuumErr != nil {
			e.logger.Warn("VACUUM压缩数据库失败", zap.Error(vacuumErr))
		} else {
			e.logger.Info("VACUUM数据库压缩完成")
		}
	}

	sizeAfter, _ := e.repo.Pressure.GetDatabaseSizeMB()

	e.logger.Info("压力数据归档完成",
		zap.Int64("archived_count", totalArchived),
		zap.Int64("deleted_count", totalDeleted),
		zap.Int("daily_stats_saved", statsSaved),
		zap.Time("cutoff_date", cutoffDate),
		zap.Float64("db_size_mb_before", sizeBefore),
		zap.Float64("db_size_mb_after", sizeAfter),
		zap.Float64("db_size_reduced_mb", sizeBefore-sizeAfter),
	)

	return totalArchived, nil
}

func (e *AlarmEngine) CalculateDailyStats(stationID uint, date time.Time) error {
	_, err := e.repo.Pressure.GetStationByID(stationID)
	if err != nil {
		return err
	}

	startTime := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endTime := startTime.Add(24 * time.Hour)

	data, err := e.repo.Pressure.GetDataForStats(stationID, startTime, endTime)
	if err != nil {
		return err
	}

	if len(data) == 0 {
		return nil
	}

	minPressure := math.MaxFloat64
	maxPressure := -math.MaxFloat64
	avgPressure := 0.0
	sum := 0.0

	for _, d := range data {
		if d.PressureValue < minPressure {
			minPressure = d.PressureValue
		}
		if d.PressureValue > maxPressure {
			maxPressure = d.PressureValue
		}
		sum += d.PressureValue
	}

	avgPressure = sum / float64(len(data))

	volatility := 0.0
	if avgPressure > 0 {
		volatility = (maxPressure - minPressure) / avgPressure
	}

	stats := &model.PressureDailyStats{
		StationID:   stationID,
		StatsDate:   startTime,
		MaxPressure: maxPressure,
		MinPressure: minPressure,
		AvgPressure: avgPressure,
		Volatility:  volatility,
		SampleCount: len(data),
		CreatedAt:   time.Now(),
	}

	return e.repo.Pressure.CreateDailyStats(stats)
}

func (e *AlarmEngine) logOperation(resourceID uint, module string, operation string) {
	log := &model.OperationLog{
		UserID:     0,
		UserName:   "SYSTEM",
		Operation:  operation,
		Module:     module,
		ResourceID: resourceID,
		IPAddress:  "127.0.0.1",
		CreatedAt:  time.Now(),
	}
	_ = e.repo.Log.Create(log)
}

func (e *AlarmEngine) GetVolatilityHistory(stationID uint) []float64 {
	window := e.getVolatilityWindow(stationID)
	return window.GetValues()
}

func (e *AlarmEngine) GetRules() []PressureRule {
	return e.rules
}

func (r *PressureRule) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"id":          r.ID,
		"name":        r.Name,
		"type":        r.Type,
		"level":       r.Level,
		"description": r.Description,
	})
}

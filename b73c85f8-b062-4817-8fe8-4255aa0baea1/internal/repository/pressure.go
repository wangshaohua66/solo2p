package repository

import (
	"gas-network-system/internal/model"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type PressureRepository struct {
	BaseRepository
}

func NewPressureRepository(db *gorm.DB, logger *zap.Logger) *PressureRepository {
	return &PressureRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *PressureRepository) CreateData(data *model.PressureData) error {
	return r.db.Create(data).Error
}

func (r *PressureRepository) BatchCreateData(dataList []model.PressureData) error {
	if len(dataList) == 0 {
		return nil
	}
	return r.db.CreateInBatches(dataList, 500).Error
}

func (r *PressureRepository) GetDataByStation(stationID uint, startTime, endTime time.Time, page, pageSize int) (int64, []model.PressureData, error) {
	var total int64
	var data []model.PressureData

	query := r.db.Model(&model.PressureData{}).Preload("Station").
		Where("station_id = ? AND timestamp BETWEEN ? AND ? AND is_archived = ?",
			stationID, startTime, endTime, false)

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("timestamp ASC").Offset(offset).Limit(pageSize).Find(&data).Error
	return total, data, err
}

func (r *PressureRepository) GetLatestData(stationID uint) (*model.PressureData, error) {
	var data model.PressureData
	err := r.db.Where("station_id = ?", stationID).Order("timestamp DESC").First(&data).Error
	if err != nil {
		return nil, err
	}
	return &data, nil
}

func (r *PressureRepository) GetDataForStats(stationID uint, startTime, endTime time.Time) ([]model.PressureData, error) {
	var data []model.PressureData
	err := r.db.Where("station_id = ? AND timestamp BETWEEN ? AND ? AND is_archived = ?",
		stationID, startTime, endTime, false).
		Order("timestamp ASC").Find(&data).Error
	return data, err
}

func (r *PressureRepository) GetHourlyStats(stationID uint, date time.Time) ([]HourlyStats, error) {
	var stats []HourlyStats
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	err := r.db.Model(&model.PressureData{}).
		Select("strftime('%Y-%m-%d %H:00:00', timestamp) as hour, " +
			"MAX(pressure_value) as max_pressure, " +
			"MIN(pressure_value) as min_pressure, " +
			"AVG(pressure_value) as avg_pressure").
		Where("station_id = ? AND timestamp BETWEEN ? AND ? AND is_archived = ?",
			stationID, startOfDay, endOfDay, false).
		Group("strftime('%Y-%m-%d %H:00:00', timestamp)").
		Order("hour ASC").
		Scan(&stats).Error

	return stats, err
}

type FiveMinStats struct {
	Window      string  `json:"window"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
	DataCount   int     `json:"data_count"`
}

func (r *PressureRepository) Get5MinStats(stationID uint, startTime, endTime time.Time) ([]FiveMinStats, error) {
	var stats []FiveMinStats

	err := r.db.Model(&model.PressureData{}).
		Select("strftime('%Y-%m-%d %H:', timestamp) || printf('%02d', (strftime('%M', timestamp) / 5) * 5) as window, " +
			"MAX(pressure_value) as max_pressure, " +
			"MIN(pressure_value) as min_pressure, " +
			"AVG(pressure_value) as avg_pressure, " +
			"COUNT(*) as data_count").
		Where("station_id = ? AND timestamp BETWEEN ? AND ? AND is_archived = ?",
			stationID, startTime, endTime, false).
		Group("window").
		Order("window ASC").
		Scan(&stats).Error

	return stats, err
}

type HourlyStats struct {
	Hour        string  `json:"hour"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
}

type DailyStatsResult struct {
	StatsDate   string  `json:"stats_date"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
	Volatility  float64 `json:"volatility"`
}

func (r *PressureRepository) GetDailyStats(stationID uint, startDate, endDate time.Time) ([]DailyStatsResult, error) {
	var stats []DailyStatsResult

	err := r.db.Model(&model.PressureDailyStats{}).
		Where("station_id = ? AND stats_date BETWEEN ? AND ?", stationID, startDate, endDate).
		Order("stats_date ASC").
		Scan(&stats).Error

	if err != nil || len(stats) > 0 {
		return stats, err
	}

	err = r.db.Model(&model.PressureData{}).
		Select("DATE(timestamp) as stats_date, " +
			"MAX(pressure_value) as max_pressure, " +
			"MIN(pressure_value) as min_pressure, " +
			"AVG(pressure_value) as avg_pressure, " +
			"0 as volatility").
		Where("station_id = ? AND timestamp BETWEEN ? AND ? AND is_archived = ?",
			stationID, startDate, endDate, false).
		Group("DATE(timestamp)").
		Order("stats_date ASC").
		Scan(&stats).Error

	return stats, err
}

func (r *PressureRepository) CreateDailyStats(stats *model.PressureDailyStats) error {
	return r.db.Create(stats).Error
}

func (r *PressureRepository) BatchCreateDailyStats(statsList []model.PressureDailyStats) error {
	if len(statsList) == 0 {
		return nil
	}
	return r.db.CreateInBatches(statsList, 100).Error
}

func (r *PressureRepository) GetDailyAggregationData(beforeDate time.Time) ([]DailyAggregationRow, error) {
	var rows []DailyAggregationRow
	err := r.db.Model(&model.PressureData{}).
		Select("station_id, DATE(timestamp) as stats_date, " +
			"MAX(pressure_value) as max_pressure, " +
			"MIN(pressure_value) as min_pressure, " +
			"AVG(pressure_value) as avg_pressure, " +
			"COUNT(*) as data_count").
		Where("timestamp < ? AND is_archived = ?", beforeDate, false).
		Group("station_id, DATE(timestamp)").
		Scan(&rows).Error
	return rows, err
}

type DailyAggregationRow struct {
	StationID   uint    `json:"station_id"`
	StatsDate   string  `json:"stats_date"`
	MaxPressure float64 `json:"max_pressure"`
	MinPressure float64 `json:"min_pressure"`
	AvgPressure float64 `json:"avg_pressure"`
	DataCount   int     `json:"data_count"`
}

func (r *PressureRepository) ArchiveOldData(beforeDate time.Time, batchSize int) (int64, error) {
	result := r.db.Model(&model.PressureData{}).
		Where("timestamp < ? AND is_archived = ?", beforeDate, false).
		Limit(batchSize).
		Update("is_archived", true)
	return result.RowsAffected, result.Error
}

func (r *PressureRepository) DeleteArchivedData(beforeDate time.Time, batchSize int) (int64, error) {
	result := r.db.Where("timestamp < ? AND is_archived = ?", beforeDate, true).
		Limit(batchSize).
		Delete(&model.PressureData{})
	return result.RowsAffected, result.Error
}

func (r *PressureRepository) SaveVolatilityPoint(stationID uint, pressureValue float64, timestamp time.Time) error {
	point := model.PressureVolatilityPoint{
		StationID:     stationID,
		PressureValue: pressureValue,
		Timestamp:     timestamp,
		CreatedAt:     time.Now(),
	}
	return r.db.Create(&point).Error
}

func (r *PressureRepository) GetVolatilityPoints(stationID uint, since time.Time, limit int) ([]model.PressureVolatilityPoint, error) {
	var points []model.PressureVolatilityPoint
	err := r.db.Where("station_id = ? AND timestamp >= ?", stationID, since).
		Order("timestamp ASC").
		Limit(limit).
		Find(&points).Error
	return points, err
}

func (r *PressureRepository) CleanVolatilityPoints(before time.Time) (int64, error) {
	result := r.db.Where("timestamp < ?", before).Delete(&model.PressureVolatilityPoint{})
	return result.RowsAffected, result.Error
}

func (r *PressureRepository) GetAllStationsWithVolatility() ([]uint, error) {
	var stationIDs []uint
	err := r.db.Model(&model.PressureVolatilityPoint{}).
		Distinct("station_id").
		Pluck("station_id", &stationIDs).Error
	return stationIDs, err
}

func (r *PressureRepository) GetStationByID(id uint) (*model.PressureRegulatingStation, error) {
	var station model.PressureRegulatingStation
	err := r.db.First(&station, id).Error
	if err != nil {
		return nil, err
	}
	return &station, nil
}

func (r *PressureRepository) GetAllStations() ([]model.PressureRegulatingStation, error) {
	var stations []model.PressureRegulatingStation
	err := r.db.Find(&stations).Error
	return stations, err
}

type TrackRepository struct {
	BaseRepository
}

func NewTrackRepository(db *gorm.DB, logger *zap.Logger) *TrackRepository {
	return &TrackRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *TrackRepository) Create(track *model.InspectionTrack) error {
	return r.db.Create(track).Error
}

func (r *TrackRepository) GetByID(id uint) (*model.InspectionTrack, error) {
	var track model.InspectionTrack
	err := r.db.Preload("Task").First(&track, id).Error
	if err != nil {
		return nil, err
	}
	return &track, nil
}

func (r *TrackRepository) List(page, pageSize int, inspectorID *uint, isDeviated *bool, startDate, endDate *time.Time) (int64, []model.InspectionTrack, error) {
	var total int64
	var tracks []model.InspectionTrack

	query := r.db.Model(&model.InspectionTrack{}).Preload("Task")
	if inspectorID != nil {
		query = query.Where("inspector_id = ?", *inspectorID)
	}
	if isDeviated != nil {
		query = query.Where("is_deviated = ?", *isDeviated)
	}
	if startDate != nil {
		query = query.Where("submit_time >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("submit_time <= ?", *endDate)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("submit_time DESC").Offset(offset).Limit(pageSize).Find(&tracks).Error
	return total, tracks, err
}

type PipelineRepository struct {
	BaseRepository
}

func NewPipelineRepository(db *gorm.DB, logger *zap.Logger) *PipelineRepository {
	return &PipelineRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *PipelineRepository) GetAllPipelines() ([]model.Pipeline, error) {
	var pipelines []model.Pipeline
	err := r.db.Find(&pipelines).Error
	return pipelines, err
}

func (r *PipelineRepository) GetPipelinesByLevel(level model.PipelineLevel) ([]model.Pipeline, error) {
	var pipelines []model.Pipeline
	err := r.db.Where("level = ?", level).Find(&pipelines).Error
	return pipelines, err
}

func (r *PipelineRepository) GetByID(id uint) (*model.Pipeline, error) {
	var pipeline model.Pipeline
	err := r.db.First(&pipeline, id).Error
	if err != nil {
		return nil, err
	}
	return &pipeline, nil
}

func (r *PipelineRepository) Create(pipeline *model.Pipeline) error {
	return r.db.Create(pipeline).Error
}

type LogRepository struct {
	BaseRepository
}

func NewLogRepository(db *gorm.DB, logger *zap.Logger) *LogRepository {
	return &LogRepository{
		BaseRepository: BaseRepository{db: db, logger: logger},
	}
}

func (r *LogRepository) Create(log *model.OperationLog) error {
	return r.db.Create(log).Error
}

func (r *LogRepository) List(page, pageSize int, userID *uint, module *string, startTime, endTime *time.Time) (int64, []model.OperationLog, error) {
	var total int64
	var logs []model.OperationLog

	query := r.db.Model(&model.OperationLog{})
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if module != nil && *module != "" {
		query = query.Where("module = ?", *module)
	}
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}

	err := query.Count(&total).Error
	if err != nil {
		return 0, nil, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error
	return total, logs, err
}

package repository

import (
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Repository struct {
	db         *gorm.DB
	logger     *zap.Logger
	Inspector  *InspectorRepository
	Alarm      *AlarmRepository
	Valve      *ValveRepository
	Hazard     *HazardRepository
	Pressure   *PressureRepository
	Repair     *RepairRepository
	Pipeline   *PipelineRepository
	Track      *TrackRepository
	Log        *LogRepository
	Assessment *AssessmentRepository
}

func NewRepository(db *gorm.DB, logger *zap.Logger) *Repository {
	r := &Repository{
		db:     db,
		logger: logger,
	}
	r.Inspector = NewInspectorRepository(db, logger)
	r.Alarm = NewAlarmRepository(db, logger)
	r.Valve = NewValveRepository(db, logger)
	r.Hazard = NewHazardRepository(db, logger)
	r.Pressure = NewPressureRepository(db, logger)
	r.Repair = NewRepairRepository(db, logger)
	r.Pipeline = NewPipelineRepository(db, logger)
	r.Track = NewTrackRepository(db, logger)
	r.Log = NewLogRepository(db, logger)
	r.Assessment = NewAssessmentRepository(db, logger)
	return r
}

type BaseRepository struct {
	db     *gorm.DB
	logger *zap.Logger
}

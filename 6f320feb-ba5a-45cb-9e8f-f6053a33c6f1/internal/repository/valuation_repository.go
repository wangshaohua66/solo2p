package repository

import (
	"equipment-trading-platform/internal/model"
)

type ValuationRepository struct {
	*BaseRepository
}

func NewValuationRepository() *ValuationRepository {
	return &ValuationRepository{NewBaseRepository()}
}

func (r *ValuationRepository) Create(report *model.ValuationReport) error {
	return r.db.Create(report).Error
}

func (r *ValuationRepository) Update(report *model.ValuationReport) error {
	return r.db.Save(report).Error
}

func (r *ValuationRepository) GetByID(id uint64) (*model.ValuationReport, error) {
	var report model.ValuationReport
	err := r.db.Preload("Assessor").First(&report, id).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *ValuationRepository) GetByReportNo(reportNo string) (*model.ValuationReport, error) {
	var report model.ValuationReport
	err := r.db.Where("report_no = ?", reportNo).Preload("Assessor").First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *ValuationRepository) GetLatestValid(deviceID uint64) (*model.ValuationReport, error) {
	var report model.ValuationReport
	err := r.db.Where("device_id = ? AND status = ?", deviceID, "valid").
		Preload("Assessor").
		Order("valuation_date DESC").
		First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *ValuationRepository) HasValidReport(deviceID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&model.ValuationReport{}).
		Where("device_id = ? AND status = ?", deviceID, "valid").
		Count(&count).Error
	return count > 0, err
}

func (r *ValuationRepository) List(deviceID *uint64, assessorID *uint64, page, pageSize int) ([]*model.ValuationReport, int64, error) {
	var reports []*model.ValuationReport
	var total int64

	db := r.db.Model(&model.ValuationReport{})

	if deviceID != nil {
		db = db.Where("device_id = ?", *deviceID)
	}
	if assessorID != nil {
		db = db.Where("assessor_id = ?", *assessorID)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page > 0 && pageSize > 0 {
		db = db.Offset((page - 1) * pageSize).Limit(pageSize)
	}
	db = db.Preload("Assessor").Order("valuation_date DESC")

	if err := db.Find(&reports).Error; err != nil {
		return nil, 0, err
	}

	return reports, total, nil
}

func (r *ValuationRepository) InvalidateByDevice(deviceID uint64) error {
	return r.db.Model(&model.ValuationReport{}).
		Where("device_id = ? AND status = ?", deviceID, "valid").
		Update("status", "invalid").Error
}

func (r *ValuationRepository) GetMarketData(region string, categoryID uint64, brand, modelName string) (*model.RegionMarket, error) {
	var market model.RegionMarket
	err := r.db.Where("region = ? AND category_id = ? AND brand = ? AND model = ?",
		region, categoryID, brand, modelName).
		Order("data_date DESC").
		First(&market).Error
	if err != nil {
		return nil, err
	}
	return &market, nil
}

func (r *ValuationRepository) CreateMarketData(market *model.RegionMarket) error {
	return r.db.Create(market).Error
}

func (r *ValuationRepository) UpdateMarketData(market *model.RegionMarket) error {
	return r.db.Save(market).Error
}

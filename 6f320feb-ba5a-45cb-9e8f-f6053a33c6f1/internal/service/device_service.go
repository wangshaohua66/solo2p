package service

import (
	"context"
	"encoding/json"
	"errors"
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/logger"
	"equipment-trading-platform/pkg/search"
	"time"

	"gorm.io/gorm"
)

type DeviceService struct {
	deviceRepo *repository.DeviceRepository
}

func NewDeviceService() *DeviceService {
	return &DeviceService{
		deviceRepo: repository.NewDeviceRepository(),
	}
}

type CreateDeviceRequest struct {
	SellerID        uint64                 `json:"seller_id"`
	CategoryID      uint64                 `json:"category_id" binding:"required"`
	Title           string                 `json:"title" binding:"required,max=255"`
	Brand           string                 `json:"brand" binding:"required"`
	Model           string                 `json:"model" binding:"required"`
	SerialNumber    string                 `json:"serial_number"`
	ManufactureYear int                    `json:"manufacture_year" binding:"required"`
	WorkHours       float64                `json:"work_hours"`
	EngineHours     float64                `json:"engine_hours"`
	Region          string                 `json:"region"`
	Province        string                 `json:"province"`
	City            string                 `json:"city"`
	OriginalPrice   float64                `json:"original_price"`
	AskingPrice     float64                `json:"asking_price" binding:"required"`
	Description     string                 `json:"description"`
	HasAccident     bool                   `json:"has_accident"`
	AccidentDetail  string                 `json:"accident_detail"`
	HasWarranty     bool                   `json:"has_warranty"`
	WarrantyExpire  *time.Time             `json:"warranty_expire"`
	EquipmentParams map[string]interface{} `json:"equipment_params"`
	Media           []MediaItem            `json:"media"`
}

type MediaItem struct {
	Type      string `json:"type"`
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"`
	Sort      int    `json:"sort"`
}

func (s *DeviceService) Create(req *CreateDeviceRequest) (*model.Device, error) {
	paramsJSON, _ := json.Marshal(req.EquipmentParams)

	device := &model.Device{
		SellerID:        req.SellerID,
		CategoryID:      req.CategoryID,
		Title:           req.Title,
		Brand:           req.Brand,
		Model:           req.Model,
		SerialNumber:    req.SerialNumber,
		ManufactureYear: req.ManufactureYear,
		WorkHours:       req.WorkHours,
		EngineHours:     req.EngineHours,
		Region:          req.Region,
		Province:        req.Province,
		City:            req.City,
		OriginalPrice:   req.OriginalPrice,
		AskingPrice:     req.AskingPrice,
		Description:     req.Description,
		Status:          model.DeviceStatusPending,
		HasAccident:     req.HasAccident,
		AccidentDetail:  req.AccidentDetail,
		HasWarranty:     req.HasWarranty,
		WarrantyExpire:  req.WarrantyExpire,
		EquipmentParams: string(paramsJSON),
	}

	if err := s.deviceRepo.CreateDevice(device); err != nil {
		return nil, err
	}

	for _, m := range req.Media {
		media := &model.DeviceMedia{
			DeviceID:  device.ID,
			Type:      m.Type,
			URL:       m.URL,
			Thumbnail: m.Thumbnail,
			Sort:      m.Sort,
		}
		if err := s.deviceRepo.CreateMedia(media); err != nil {
			logger.Warnf("create device media failed: %v", err)
		}
	}

	go s.indexDevice(device)

	return device, nil
}

func (s *DeviceService) indexDevice(device *model.Device) {
	category, _ := s.deviceRepo.GetCategoryByID(device.CategoryID)
	categoryName := ""
	if category != nil {
		categoryName = category.Name
	}

	doc := &search.DeviceDoc{
		ID:              device.ID,
		CategoryID:      device.CategoryID,
		CategoryName:    categoryName,
		Brand:           device.Brand,
		Model:           device.Model,
		Title:           device.Title,
		Description:     device.Description,
		Region:          device.Region,
		Status:          device.Status,
		Price:           device.AskingPrice,
		ValuationPrice:  device.ValuationPrice,
		ManufactureYear: device.ManufactureYear,
		WorkHours:       device.WorkHours,
		SellerID:        device.SellerID,
	}

	if err := search.IndexDevice(doc); err != nil {
		logger.Warnf("index device %d to es failed: %v", device.ID, err)
	}
}

func (s *DeviceService) Update(id uint64, req *CreateDeviceRequest) (*model.Device, error) {
	device, err := s.deviceRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrDeviceNotFound
		}
		return nil, err
	}

	paramsJSON, _ := json.Marshal(req.EquipmentParams)

	device.CategoryID = req.CategoryID
	device.Title = req.Title
	device.Brand = req.Brand
	device.Model = req.Model
	device.SerialNumber = req.SerialNumber
	device.ManufactureYear = req.ManufactureYear
	device.WorkHours = req.WorkHours
	device.EngineHours = req.EngineHours
	device.Region = req.Region
	device.Province = req.Province
	device.City = req.City
	device.OriginalPrice = req.OriginalPrice
	device.AskingPrice = req.AskingPrice
	device.Description = req.Description
	device.HasAccident = req.HasAccident
	device.AccidentDetail = req.AccidentDetail
	device.HasWarranty = req.HasWarranty
	device.WarrantyExpire = req.WarrantyExpire
	device.EquipmentParams = string(paramsJSON)

	if err := s.deviceRepo.UpdateDevice(device); err != nil {
		return nil, err
	}

	go s.indexDevice(device)

	return device, nil
}

func (s *DeviceService) GetByID(id uint64, withDetail bool) (*model.Device, error) {
	var device *model.Device
	var err error

	if withDetail {
		device, err = s.deviceRepo.GetByIDWithDetail(id)
	} else {
		device, err = s.deviceRepo.GetByID(id)
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrDeviceNotFound
		}
		return nil, err
	}

	go s.deviceRepo.IncrementViewCount(id)

	return device, nil
}

func (s *DeviceService) List(q *repository.DeviceQuery) ([]*model.Device, int64, error) {
	return s.deviceRepo.ListDevices(q)
}

func (s *DeviceService) Approve(id, approverID uint64) error {
	device, err := s.deviceRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrDeviceNotFound
		}
		return err
	}

	if device.Status != model.DeviceStatusPending {
		return util.ErrDeviceStatus
	}

	now := time.Now()
	return s.deviceRepo.GetDB().Model(device).Updates(map[string]interface{}{
		"status":      model.DeviceStatusOnSale,
		"approved_at": &now,
		"approved_by": &approverID,
	}).Error
}

func (s *DeviceService) UpdateStatus(id uint64, status string) error {
	validStatuses := map[string]bool{
		model.DeviceStatusPending:  true,
		model.DeviceStatusOnSale:   true,
		model.DeviceStatusReserved: true,
		model.DeviceStatusSold:     true,
		model.DeviceStatusOffShelf: true,
	}

	if !validStatuses[status] {
		return util.NewAppError(400, 2003, "无效的设备状态")
	}

	return s.deviceRepo.UpdateStatus(id, status)
}

func (s *DeviceService) OffShelf(id, sellerID uint64) error {
	device, err := s.deviceRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrDeviceNotFound
		}
		return err
	}

	if device.SellerID != sellerID {
		return util.ErrForbidden
	}

	if device.Status != model.DeviceStatusOnSale {
		return util.ErrDeviceStatus
	}

	return s.deviceRepo.UpdateStatus(id, model.DeviceStatusOffShelf)
}

func (s *DeviceService) Delete(id, sellerID uint64) error {
	device, err := s.deviceRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.ErrDeviceNotFound
		}
		return err
	}

	if device.SellerID != sellerID {
		return util.ErrForbidden
	}

	go func() {
		_ = search.DeleteDevice(id)
	}()

	return s.deviceRepo.Delete(device)
}

func (s *DeviceService) AddMaintenanceRecord(record *model.MaintenanceRecord) error {
	return s.deviceRepo.CreateMaintenanceRecord(record)
}

func (s *DeviceService) ListMaintenanceRecords(deviceID uint64) ([]*model.MaintenanceRecord, error) {
	return s.deviceRepo.ListMaintenanceRecords(deviceID)
}

func (s *DeviceService) ListOwnershipChanges(deviceID uint64) ([]*model.OwnershipChange, error) {
	return s.deviceRepo.ListOwnershipChanges(deviceID)
}

func (s *DeviceService) AddMedia(media *model.DeviceMedia) error {
	return s.deviceRepo.CreateMedia(media)
}

func (s *DeviceService) DeleteMedia(id, sellerID uint64) error {
	var media model.DeviceMedia
	if err := s.deviceRepo.GetDB().Where("id = ?", id).First(&media).Error; err != nil {
		return err
	}
	var device model.Device
	if err := s.deviceRepo.GetDB().Where("id = ?", media.DeviceID).First(&device).Error; err != nil {
		return err
	}
	if device.SellerID != sellerID {
		return util.ErrForbidden
	}
	return s.deviceRepo.DeleteMedia(id)
}

func (s *DeviceService) ListCategories() ([]*model.DeviceCategory, error) {
	return s.deviceRepo.ListCategories()
}

func (s *DeviceService) InitCategories() error {
	categories := []*model.DeviceCategory{
		{Name: "挖掘机", Code: "EXCAVATOR", Sort: 1},
		{Name: "装载机", Code: "LOADER", Sort: 2},
		{Name: "起重机", Code: "CRANE", Sort: 3},
		{Name: "压路机", Code: "ROLLER", Sort: 4},
		{Name: "钻机", Code: "DRILL", Sort: 5},
		{Name: "泵车", Code: "PUMP_TRUCK", Sort: 6},
		{Name: "推土机", Code: "BULLDOZER", Sort: 7},
		{Name: "摊铺机", Code: "PAVER", Sort: 8},
		{Name: "叉车", Code: "FORKLIFT", Sort: 9},
		{Name: "搅拌车", Code: "MIXER_TRUCK", Sort: 10},
		{Name: "自卸车", Code: "DUMP_TRUCK", Sort: 11},
		{Name: "平地机", Code: "GRADER", Sort: 12},
		{Name: "铣刨机", Code: "MILLING_MACHINE", Sort: 13},
		{Name: "空压机", Code: "AIR_COMPRESSOR", Sort: 14},
		{Name: "发电机", Code: "GENERATOR", Sort: 15},
	}

	for _, cat := range categories {
		var existing model.DeviceCategory
		err := s.deviceRepo.GetDB().Where("code = ?", cat.Code).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := s.deviceRepo.GetDB().Create(cat).Error; err != nil {
				logger.Warnf("create category %s failed: %v", cat.Name, err)
			}
		}
	}
	return nil
}

func (s *DeviceService) Search(q *search.SearchQuery) (*search.SearchResult, error) {
	return search.SearchDevices(q)
}

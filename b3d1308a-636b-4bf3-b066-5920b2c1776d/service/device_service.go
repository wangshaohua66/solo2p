package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"smart-lighting-api/config"
	"smart-lighting-api/middleware"
	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DeviceService struct {
	db          *gorm.DB
	deviceRepo  *repository.DeviceRepo
	commandRepo *repository.CommandRepo
	areaRepo    *repository.AreaRepo
	cabinetRepo *repository.CabinetRepo
}

func NewDeviceService(db *gorm.DB,
	deviceRepo *repository.DeviceRepo,
	commandRepo *repository.CommandRepo,
	areaRepo *repository.AreaRepo,
	cabinetRepo *repository.CabinetRepo) *DeviceService {
	return &DeviceService{
		db:          db,
		deviceRepo:  deviceRepo,
		commandRepo: commandRepo,
		areaRepo:    areaRepo,
		cabinetRepo: cabinetRepo,
	}
}

type RegisterDeviceRequest struct {
	DeviceCode   string  `json:"device_code" validate:"required,device_code"`
	DeviceType   string  `json:"device_type" validate:"required,device_type"`
	AreaID       int64   `json:"area_id" validate:"required,gt=0"`
	CabinetID    int64   `json:"cabinet_id"`
	Name         string  `json:"name" validate:"max=128"`
	Longitude    float64 `json:"longitude"`
	Latitude     float64 `json:"latitude"`
	Manufacturer string  `json:"manufacturer" validate:"max=128"`
	Model        string  `json:"model" validate:"max=128"`
	RatedPower   float64 `json:"rated_power" validate:"gte=0"`
	RatedVoltage float64 `json:"rated_voltage" validate:"gte=0"`
}

func (s *DeviceService) RegisterDevice(ctx context.Context, req *RegisterDeviceRequest) (*model.Device, error) {
	existing, _ := s.deviceRepo.GetByCode(ctx, req.DeviceCode)
	if existing != nil {
		return nil, fmt.Errorf("设备编码已存在")
	}
	device := &model.Device{
		DeviceCode:    req.DeviceCode,
		DeviceType:    req.DeviceType,
		AreaID:        req.AreaID,
		CabinetID:     req.CabinetID,
		Name:          req.Name,
		Longitude:     req.Longitude,
		Latitude:      req.Latitude,
		InstallDate:   time.Now(),
		Manufacturer:  req.Manufacturer,
		Model:         req.Model,
		RatedPower:    req.RatedPower,
		RatedVoltage:  req.RatedVoltage,
		Status:        model.DeviceStatusOffline,
		Brightness:    100,
		IsOn:          false,
		HealthScore:   100,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if device.Name == "" {
		device.Name = device.DeviceCode
	}
	if err := s.deviceRepo.Create(ctx, device); err != nil {
		return nil, err
	}
	_ = s.areaRepo.UpdateDeviceCount(ctx, req.AreaID)
	return device, nil
}

type ReportDeviceStatusRequest struct {
	DeviceCode  string  `json:"device_code" validate:"required"`
	Voltage     float64 `json:"voltage" validate:"gte=0"`
	Current     float64 `json:"current" validate:"gte=0"`
	Power       float64 `json:"power" validate:"gte=0"`
	Brightness  int     `json:"brightness" validate:"gte=0,lte=100"`
	Temperature float64 `json:"temperature"`
	IsOn        bool    `json:"is_on"`
	Signal      int     `json:"signal" validate:"gte=0,lte=100"`
	ReportTime  string  `json:"report_time"`
}

func (s *DeviceService) ReportStatus(ctx context.Context, req *ReportDeviceStatusRequest) error {
	device, err := s.deviceRepo.GetByCode(ctx, req.DeviceCode)
	if err != nil {
		return fmt.Errorf("设备不存在: %w", err)
	}
	reportTime := time.Now()
	if req.ReportTime != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", req.ReportTime); err == nil {
			reportTime = t
		}
	}
	status := &model.DeviceStatus{
		DeviceID:    device.ID,
		Voltage:     req.Voltage,
		Current:     req.Current,
		Power:       req.Power,
		Brightness:  req.Brightness,
		Temperature: req.Temperature,
		IsOn:        req.IsOn,
		Signal:      req.Signal,
		ReportTime:  reportTime,
		CreatedAt:   time.Now(),
	}
	if err := s.deviceRepo.InsertStatus(ctx, status); err != nil {
		return err
	}
	updates := map[string]interface{}{
		"last_report_at": reportTime,
		"is_on":          req.IsOn,
		"brightness":     req.Brightness,
		"status":         model.DeviceStatusOnline,
		"updated_at":     time.Now(),
	}
	return s.db.WithContext(ctx).Model(device).Updates(updates).Error
}

type BatchControlRequest struct {
	CommandType string  `json:"command_type" validate:"required,command_type"`
	AreaID      int64   `json:"area_id"`
	CabinetID   int64   `json:"cabinet_id"`
	DeviceIDs   []int64 `json:"device_ids"`
	Brightness  int     `json:"brightness" validate:"gte=0,lte=100"`
	Timeout     int     `json:"timeout" validate:"gt=0"`
	MaxRetry    int     `json:"max_retry" validate:"gte=0,lte=5"`
}

func (s *DeviceService) BatchControl(ctx context.Context, creatorID int64, req *BatchControlRequest) (*model.ControlCommand, error) {
	maxSize := config.AppConf.App.BatchControlSize
	if len(req.DeviceIDs) > maxSize {
		return nil, fmt.Errorf("单次批量控制不能超过 %d 台设备", maxSize)
	}
	var targetDeviceIDs []int64
	areaID := req.AreaID
	switch {
	case len(req.DeviceIDs) > 0:
		targetDeviceIDs = req.DeviceIDs
		devices, err := s.deviceRepo.ListByIDs(ctx, req.DeviceIDs)
		if err != nil {
			return nil, err
		}
		if len(devices) > 0 && areaID == 0 {
			areaID = devices[0].AreaID
		}
	case req.CabinetID > 0:
		devices, err := s.deviceRepo.ListByCabinetID(ctx, req.CabinetID)
		if err != nil {
			return nil, err
		}
		for _, d := range devices {
			targetDeviceIDs = append(targetDeviceIDs, d.ID)
		}
		if len(devices) > 0 {
			areaID = devices[0].AreaID
		}
	case req.AreaID > 0:
		ids, err := s.deviceRepo.GetAllIDs(ctx, []int64{req.AreaID})
		if err != nil {
			return nil, err
		}
		targetDeviceIDs = ids
	default:
		return nil, fmt.Errorf("请指定控制范围: 区域/配电柜/设备列表")
	}
	if len(targetDeviceIDs) == 0 {
		return nil, fmt.Errorf("未找到可控制的设备")
	}
	if len(targetDeviceIDs) > maxSize {
		targetDeviceIDs = targetDeviceIDs[:maxSize]
	}
	idStrs := make([]string, 0, len(targetDeviceIDs))
	for _, id := range targetDeviceIDs {
		idStrs = append(idStrs, strconv.FormatInt(id, 10))
	}
	timeout := req.Timeout
	if timeout == 0 {
		timeout = config.AppConf.App.CommandTimeoutSeconds
	}
	maxRetry := req.MaxRetry
	if maxRetry == 0 {
		maxRetry = 3
	}
	command := &model.ControlCommand{
		CommandCode: "CMD" + uuid.New().String()[:15],
		CommandType: req.CommandType,
		Brightness:  req.Brightness,
		AreaID:      areaID,
		DeviceIDs:   strings.Join(idStrs, ","),
		DeviceCount: len(targetDeviceIDs),
		Status:      model.CommandStatusPending,
		RetryCount:  0,
		MaxRetry:    maxRetry,
		Timeout:     timeout,
		CreatorID:   creatorID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		cmdRepo := repository.NewCommandRepo(tx)
		if err := cmdRepo.Create(ctx, command); err != nil {
			return err
		}
		details := make([]*model.ControlCommandDetail, 0, len(targetDeviceIDs))
		for _, did := range targetDeviceIDs {
			details = append(details, &model.ControlCommandDetail{
				CommandID: command.ID,
				DeviceID:  did,
				Status:    model.CommandStatusPending,
				CreatedAt: time.Now(),
			})
		}
		return cmdRepo.BatchCreateDetails(ctx, details)
	})
	if err != nil {
		return nil, err
	}
	go s.executeCommand(ctx, command.ID)
	return command, nil
}

func (s *DeviceService) executeCommand(ctx context.Context, commandID int64) {
	cmd, err := s.commandRepo.GetByID(ctx, commandID)
	if err != nil {
		pkg.Error(ctx, "command not found for execution",
			zap.Int64("command_id", commandID),
			zap.Error(err))
		return
	}
	cmd.Status = model.CommandStatusExecuting
	cmd.ExecuteAt = time.Now()
	cmd.UpdatedAt = time.Now()
	_ = s.commandRepo.Update(ctx, cmd)
	pkg.Info(ctx, "executing control command",
		zap.Int64("command_id", commandID),
		zap.String("command_type", cmd.CommandType),
		zap.Int("device_count", cmd.DeviceCount))
	deviceIDs := s.parseDeviceIDs(cmd.DeviceIDs)
	isOn := cmd.CommandType == model.CommandTypeOn
	brightness := cmd.Brightness
	if brightness == 0 {
		brightness = 100
	}
	status := model.DeviceStatusOnline
	batchSize := 500
	for i := 0; i < len(deviceIDs); i += batchSize {
		end := i + batchSize
		if end > len(deviceIDs) {
			end = len(deviceIDs)
		}
		batch := deviceIDs[i:end]
		_ = s.deviceRepo.BatchUpdateStatus(ctx, batch, status, isOn, brightness)
		_ = s.db.Model(&model.ControlCommandDetail{}).
			Where("command_id = ? AND device_id IN ?", cmd.ID, batch).
			Updates(map[string]interface{}{
				"status":      model.CommandStatusSuccess,
				"execute_at":  time.Now(),
				"complete_at": time.Now(),
			}).Error
	}
	cmd.SuccessCount = len(deviceIDs)
	cmd.FailedCount = 0
	cmd.Status = model.CommandStatusSuccess
	cmd.CompleteAt = time.Now()
	cmd.UpdatedAt = time.Now()
	_ = s.commandRepo.Update(ctx, cmd)
	pkg.Info(ctx, "control command completed",
		zap.Int64("command_id", commandID),
		zap.Int("success_count", cmd.SuccessCount),
		zap.Int("failed_count", cmd.FailedCount))
}

func (s *DeviceService) parseDeviceIDs(idsStr string) []int64 {
	if idsStr == "" {
		return nil
	}
	parts := strings.Split(idsStr, ",")
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			if id, err := strconv.ParseInt(p, 10, 64); err == nil {
				ids = append(ids, id)
			}
		}
	}
	return ids
}

func (s *DeviceService) GetCommandStatus(ctx context.Context, commandID int64) (*model.ControlCommand, []*model.ControlCommandDetail, int64, error) {
	cmd, err := s.commandRepo.GetByID(ctx, commandID)
	if err != nil {
		return nil, nil, 0, err
	}
	details, total, err := s.commandRepo.GetDetailsByCommand(ctx, commandID, "", 1, 100)
	return cmd, details, total, err
}

func (s *DeviceService) RetryFailedCommand(ctx context.Context, commandID int64) error {
	cmd, err := s.commandRepo.GetByID(ctx, commandID)
	if err != nil {
		return err
	}
	if cmd.RetryCount >= cmd.MaxRetry {
		return fmt.Errorf("已达到最大重试次数")
	}
	cmd.RetryCount++
	cmd.Status = model.CommandStatusExecuting
	cmd.UpdatedAt = time.Now()
	_ = s.commandRepo.Update(ctx, cmd)
	go s.retryFailedDetails(ctx, cmd)
	return nil
}

func (s *DeviceService) retryFailedDetails(ctx context.Context, cmd *model.ControlCommand) {
	var failedDetails []*model.ControlCommandDetail
	_ = s.db.Where("command_id = ? AND status IN ?", cmd.ID,
		[]string{model.CommandStatusFailed, model.CommandStatusTimeout}).
		Find(&failedDetails).Error
	failedIDs := make([]int64, 0, len(failedDetails))
	for _, d := range failedDetails {
		failedIDs = append(failedIDs, d.DeviceID)
	}
	isOn := cmd.CommandType == model.CommandTypeOn
	brightness := cmd.Brightness
	if brightness == 0 {
		brightness = 100
	}
	_ = s.deviceRepo.BatchUpdateStatus(ctx, failedIDs, model.DeviceStatusOnline, isOn, brightness)
	cmd.Status = model.CommandStatusSuccess
	cmd.CompleteAt = time.Now()
	_ = s.commandRepo.Update(ctx, cmd)
}

func (s *DeviceService) GetVisibleAreaIDs(ctx context.Context) []int64 {
	role := middleware.GetRole(ctx)
	userAreaID := middleware.GetAreaID(ctx)
	var areaIDs []int64
	switch role {
	case model.RoleAdmin:
		areas, _ := s.areaRepo.ListAll(ctx)
		for _, a := range areas {
			areaIDs = append(areaIDs, a.ID)
		}
	case model.RoleAreaManager, model.RoleOperator:
		if userAreaID > 0 {
			subIDs, _ := s.areaRepo.GetSubAreaIDs(ctx, userAreaID)
			areaIDs = subIDs
		}
	}
	return areaIDs
}

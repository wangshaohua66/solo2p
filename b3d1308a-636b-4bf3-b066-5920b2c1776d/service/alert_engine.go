package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AlertEngine struct {
	db          *gorm.DB
	deviceRepo  *repository.DeviceRepo
	faultRepo   *repository.FaultRepo
	workOrderRepo *repository.WorkOrderRepo
	userRepo    *repository.UserRepo
	areaRepo    *repository.AreaRepo
}

func NewAlertEngine(db *gorm.DB,
	deviceRepo *repository.DeviceRepo,
	faultRepo *repository.FaultRepo,
	workOrderRepo *repository.WorkOrderRepo,
	userRepo *repository.UserRepo,
	areaRepo *repository.AreaRepo) *AlertEngine {
	return &AlertEngine{
		db:            db,
		deviceRepo:    deviceRepo,
		faultRepo:     faultRepo,
		workOrderRepo: workOrderRepo,
		userRepo:      userRepo,
		areaRepo:      areaRepo,
	}
}

type FaultCheckResult struct {
	IsFault      bool
	FaultType    string
	FaultName    string
	FaultLevel   string
	Description  string
	TriggerValue float64
	RuleID       int64
}

func (e *AlertEngine) ScanAndDetectFaults(ctx context.Context) (int, error) {
	pkg.Info(ctx, "starting fault detection scan")
	startTime := time.Now()

	rules, err := e.faultRepo.GetAllRules(ctx)
	if err != nil {
		pkg.Error(ctx, "failed to get fault rules", zap.Error(err))
		return 0, err
	}
	if len(rules) == 0 {
		pkg.Warn(ctx, "no enabled fault rules found")
		return 0, nil
	}

	devices, err := e.deviceRepo.FindOfflineDevices(ctx, 30, nil)
	if err != nil {
		pkg.Error(ctx, "failed to get devices for scan", zap.Error(err))
		return 0, err
	}
	totalDevices := len(devices)
	pkg.Info(ctx, fmt.Sprintf("found %d devices to check", totalDevices))

	allIDs, err := e.deviceRepo.GetAllIDs(ctx, nil)
	if err != nil {
		pkg.Error(ctx, "failed to get all device ids", zap.Error(err))
		return 0, err
	}
	allDeviceIDs := make([]int64, 0, len(allIDs))
	seen := make(map[int64]bool)
	for _, d := range devices {
		seen[d.ID] = true
		allDeviceIDs = append(allDeviceIDs, d.ID)
	}
	for _, id := range allIDs {
		if !seen[id] {
			allDeviceIDs = append(allDeviceIDs, id)
		}
	}

	batchSize := 200
	newFaultCount := 0
	for i := 0; i < len(allDeviceIDs); i += batchSize {
		end := i + batchSize
		if end > len(allDeviceIDs) {
			end = len(allDeviceIDs)
		}
		batchIDs := allDeviceIDs[i:end]

		for _, deviceID := range batchIDs {
			results, err := e.checkDeviceFaults(ctx, deviceID, rules)
			if err != nil {
				pkg.Warn(ctx, "failed to check device faults",
					zap.Int64("device_id", deviceID),
					zap.Error(err))
				continue
			}
			for _, r := range results {
				if r.IsFault {
					if err := e.createFaultAndAlert(ctx, deviceID, r); err != nil {
						pkg.Error(ctx, "failed to create fault",
							zap.Int64("device_id", deviceID),
							zap.String("fault_type", r.FaultType),
							zap.Error(err))
						continue
					}
					newFaultCount++
				}
			}
		}
	}

	elapsed := time.Since(startTime)
	pkg.Info(ctx, fmt.Sprintf("fault detection completed: %d new faults, took %v", newFaultCount, elapsed))
	return newFaultCount, nil
}

func (e *AlertEngine) checkDeviceFaults(ctx context.Context, deviceID int64, rules []*model.FaultRule) ([]*FaultCheckResult, error) {
	device, err := e.deviceRepo.GetByID(ctx, deviceID)
	if err != nil {
		return nil, err
	}

	statuses, err := e.deviceRepo.GetRecentStatuses(ctx, deviceID, 60)
	if err != nil {
		return nil, err
	}
	if len(statuses) == 0 {
		statuses = make([]*model.DeviceStatus, 0)
	}

	latestStatus, err := e.deviceRepo.GetLatestStatus(ctx, deviceID)
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var results []*FaultCheckResult
	for _, rule := range rules {
		result := e.applyFaultRule(ctx, device, latestStatus, statuses, rule)
		results = append(results, result)
	}

	commResult := e.checkCommunicationInterrupt(ctx, device)
	results = append(results, commResult)

	return results, nil
}

func (e *AlertEngine) applyFaultRule(ctx context.Context,
	device *model.Device,
	latestStatus *model.DeviceStatus,
	statuses []*model.DeviceStatus,
	rule *model.FaultRule) *FaultCheckResult {

	if latestStatus == nil {
		return &FaultCheckResult{IsFault: false}
	}

	result := &FaultCheckResult{
		FaultType:  rule.FaultType,
		FaultName:  rule.FaultName,
		FaultLevel: rule.FaultLevel,
		RuleID:     rule.ID,
	}

	var triggerValue float64
	switch rule.FaultType {
	case model.FaultTypeVoltageAbnormal:
		triggerValue = latestStatus.Voltage
		if triggerValue > 0 && (triggerValue < rule.ThresholdMin || triggerValue > rule.ThresholdMax) {
			if e.checkSustainedCondition(statuses, func(s *model.DeviceStatus) bool {
				return s.Voltage > 0 && (s.Voltage < rule.ThresholdMin || s.Voltage > rule.ThresholdMax)
			}, rule.Duration) {
				result.IsFault = true
				result.TriggerValue = triggerValue
				result.Description = fmt.Sprintf("电压异常: %.2fV, 正常范围 %.2fV~%.2fV", triggerValue, rule.ThresholdMin, rule.ThresholdMax)
			}
		}

	case model.FaultTypeOverCurrent:
		triggerValue = latestStatus.Current
		if triggerValue > rule.ThresholdMax {
			if e.checkSustainedCondition(statuses, func(s *model.DeviceStatus) bool {
				return s.Current > rule.ThresholdMax
			}, rule.Duration) {
				result.IsFault = true
				result.TriggerValue = triggerValue
				result.Description = fmt.Sprintf("电流过载: %.3fA, 阈值 %.3fA", triggerValue, rule.ThresholdMax)
			}
		}

	case model.FaultTypeBrightnessDecay:
		ratedBrightness := 100.0
		actual := float64(latestStatus.Brightness)
		thresholdMin := ratedBrightness * rule.ThresholdMin / 100
		if actual > 0 && actual < thresholdMin {
			if e.checkSustainedCondition(statuses, func(s *model.DeviceStatus) bool {
				return float64(s.Brightness) > 0 && float64(s.Brightness) < ratedBrightness*rule.ThresholdMin/100
			}, rule.Duration) {
				result.IsFault = true
				result.TriggerValue = actual
				result.Description = fmt.Sprintf("亮度衰减: %.0f%%, 阈值低于 %.0f%%", actual, rule.ThresholdMin)
			}
		}

	case model.FaultTypeOverTemperature:
		triggerValue = latestStatus.Temperature
		if triggerValue > rule.ThresholdMax {
			if e.checkSustainedCondition(statuses, func(s *model.DeviceStatus) bool {
				return s.Temperature > rule.ThresholdMax
			}, rule.Duration) {
				result.IsFault = true
				result.TriggerValue = triggerValue
				result.Description = fmt.Sprintf("温度过高: %.1f°C, 阈值 %.1f°C", triggerValue, rule.ThresholdMax)
			}
		}

	case model.FaultTypePowerAbnormal:
		triggerValue = latestStatus.Power
		if device.RatedPower > 0 && triggerValue > 0 {
			deviation := math.Abs(triggerValue-device.RatedPower) / device.RatedPower * 100
			if deviation > rule.ThresholdMax {
				result.IsFault = true
				result.TriggerValue = triggerValue
				result.Description = fmt.Sprintf("功率异常: %.2fW, 额定功率 %.2fW, 偏差 %.1f%%", triggerValue, device.RatedPower, deviation)
			}
		}

	case model.FaultTypeLightOff:
		if !latestStatus.IsOn && device.IsOn {
			result.IsFault = true
			result.TriggerValue = 0
			result.Description = "灯具异常熄灭"
		}
	}

	return result
}

func (e *AlertEngine) checkSustainedCondition(statuses []*model.DeviceStatus,
	condition func(*model.DeviceStatus) bool,
	durationMinutes int) bool {
	if durationMinutes <= 0 {
		for _, s := range statuses {
			if condition(s) {
				return true
			}
		}
		return len(statuses) > 0 && condition(statuses[len(statuses)-1])
	}

	consecutiveCount := 0
	for _, s := range statuses {
		if condition(s) {
			consecutiveCount++
		} else {
			consecutiveCount = 0
		}
	}
	expectedCount := durationMinutes / 15
	if expectedCount < 1 {
		expectedCount = 1
	}
	return consecutiveCount >= expectedCount
}

func (e *AlertEngine) checkCommunicationInterrupt(ctx context.Context, device *model.Device) *FaultCheckResult {
	result := &FaultCheckResult{
		FaultType:  model.FaultTypeCommInterrupt,
		FaultName:  "通信中断",
		FaultLevel: model.FaultLevelMajor,
	}

	if device.LastReportAt.IsZero() {
		result.IsFault = false
		return result
	}

	offlineThreshold := 30 * time.Minute
	if time.Since(device.LastReportAt) > offlineThreshold && device.Status != model.DeviceStatusOffline {
		result.IsFault = true
		hours := int(time.Since(device.LastReportAt).Hours())
		minutes := int(time.Since(device.LastReportAt).Minutes()) % 60
		result.Description = fmt.Sprintf("设备通信中断, 上次上报: %d小时%d分钟前", hours, minutes)
	}
	return result
}

func (e *AlertEngine) createFaultAndAlert(ctx context.Context, deviceID int64, checkResult *FaultCheckResult) error {
	return e.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existingCount := int64(0)
		if err := tx.Model(&model.Fault{}).
			Where("device_id = ? AND fault_type = ? AND status IN ?",
				deviceID, checkResult.FaultType, []string{"pending", "handled"}).
			Count(&existingCount).Error; err != nil {
			return err
		}
		if existingCount > 0 {
			return nil
		}

		fault := &model.Fault{
			FaultCode:    "F" + uuid.New().String()[:15],
			DeviceID:     deviceID,
			FaultType:    checkResult.FaultType,
			FaultName:    checkResult.FaultName,
			FaultLevel:   checkResult.FaultLevel,
			Description:  checkResult.Description,
			RuleID:       checkResult.RuleID,
			TriggerValue: checkResult.TriggerValue,
			Status:       model.AlertStatusPending,
			OccurredAt:   time.Now(),
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		if err := tx.Create(fault).Error; err != nil {
			return err
		}

		device := &model.Device{}
		if err := tx.First(device, deviceID).Error; err == nil {
			newScore := e.calculateHealthScore(device, checkResult)
			if newScore < device.HealthScore {
				if err := tx.Model(device).Update("health_score", newScore).Error; err != nil {
					pkg.Warn(ctx, "failed to update health score", zap.Error(err))
				}
			}
			if checkResult.FaultLevel == model.FaultLevelCritical || checkResult.FaultLevel == model.FaultLevelMajor {
				if err := tx.Model(device).Updates(map[string]interface{}{
					"status":     model.DeviceStatusFault,
					"updated_at": time.Now(),
				}).Error; err != nil {
					pkg.Warn(ctx, "failed to update device status", zap.Error(err))
				}
			}
		}

		alert := &model.Alert{
			AlertCode:    "A" + uuid.New().String()[:15],
			DeviceID:     deviceID,
			FaultID:      fault.ID,
			AlertType:    checkResult.FaultType,
			AlertLevel:   checkResult.FaultLevel,
			Title:        fmt.Sprintf("[%s] %s", checkResult.FaultName, checkResult.Description),
			Content:      fmt.Sprintf("设备ID: %d\n故障类型: %s\n故障描述: %s\n发生时间: %s", deviceID, checkResult.FaultName, checkResult.Description, time.Now().Format("2006-01-02 15:04:05")),
			Status:       model.AlertStatusPending,
			PushChannels: "app,sms",
			CreatedAt:    time.Now(),
		}
		if err := tx.Create(alert).Error; err != nil {
			return err
		}

		priority := model.PriorityMedium
		switch checkResult.FaultLevel {
		case model.FaultLevelCritical:
			priority = model.PriorityHigh
		case model.FaultLevelWarning:
			priority = model.PriorityLow
		}

		areaID := int64(0)
		if err := tx.Model(&model.Device{}).Select("area_id").Where("id = ?", deviceID).Scan(&areaID).Error; err != nil {
			areaID = 0
		}

		var assigneeID int64
		woRepo := repository.NewWorkOrderRepo(tx)
		id, _, err := woRepo.GetLeastBusyOperator(ctx, areaID, model.RoleOperator)
		if err == nil && id > 0 {
			assigneeID = id
		}

		order := &model.WorkOrder{
			OrderCode:   "WO" + uuid.New().String()[:15],
			Title:       fmt.Sprintf("%s - 设备故障维修", checkResult.FaultName),
			Description: checkResult.Description,
			FaultID:     fault.ID,
			DeviceID:    deviceID,
			AreaID:      areaID,
			Priority:    priority,
			Status:      model.WorkOrderStatusCreated,
			CreatorID:   0,
			AssigneeID:  assigneeID,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		switch priority {
		case model.PriorityHigh:
			order.DueTime = time.Now().Add(4 * time.Hour)
		case model.PriorityMedium:
			order.DueTime = time.Now().Add(24 * time.Hour)
		case model.PriorityLow:
			order.DueTime = time.Now().Add(72 * time.Hour)
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		fault.WorkOrderID = order.ID
		if err := tx.Save(fault).Error; err != nil {
			return err
		}

		log := &model.WorkOrderLog{
			WorkOrderID: order.ID,
			FromStatus:  "",
			ToStatus:    model.WorkOrderStatusCreated,
			OperatorID:  0,
			Remark:      "系统自动创建工单",
			CreatedAt:   time.Now(),
		}
		if err := tx.Create(log).Error; err != nil {
			return err
		}

		pkg.Info(ctx, "fault auto-detected and work order created",
			zap.Int64("device_id", deviceID),
			zap.Int64("fault_id", fault.ID),
			zap.Int64("work_order_id", order.ID),
			zap.String("fault_type", checkResult.FaultType),
			zap.String("fault_level", checkResult.FaultLevel))

		return nil
	})
}

func (e *AlertEngine) calculateHealthScore(device *model.Device, result *FaultCheckResult) int {
	score := device.HealthScore
	deduction := 0
	switch result.FaultLevel {
	case model.FaultLevelCritical:
		deduction = 30
	case model.FaultLevelMajor:
		deduction = 20
	case model.FaultLevelMinor:
		deduction = 10
	case model.FaultLevelWarning:
		deduction = 5
	}
	score -= deduction
	if score < 0 {
		score = 0
	}
	return score
}

func (e *AlertEngine) HandleFaultRecovery(ctx context.Context, deviceID int64) (int64, error) {
	recovered, err := e.faultRepo.RecoverFaults(ctx, deviceID)
	if err != nil {
		return 0, err
	}
	if recovered > 0 {
		pkg.Info(ctx, "faults recovered for device",
			zap.Int64("device_id", deviceID),
			zap.Int64("recovered_count", recovered))
	}
	return recovered, nil
}

func (e *AlertEngine) PushAlert(ctx context.Context, alert *model.Alert) error {
	pkg.Info(ctx, "sending alert notification",
		zap.Int64("alert_id", alert.ID),
		zap.String("channels", alert.PushChannels),
		zap.String("title", alert.Title))
	return nil
}

func (e *AlertEngine) InitDefaultRules(ctx context.Context) error {
	defaultRules := []*model.FaultRule{
		{FaultType: model.FaultTypeVoltageAbnormal, FaultName: "电压异常", Description: "检测电压是否超出正常范围", ThresholdMin: 198, ThresholdMax: 242, Weight: 3, FaultLevel: model.FaultLevelMajor, Duration: 30},
		{FaultType: model.FaultTypeOverCurrent, FaultName: "电流过载", Description: "检测电流是否超过阈值", ThresholdMin: 0, ThresholdMax: 10, Weight: 4, FaultLevel: model.FaultLevelCritical, Duration: 15},
		{FaultType: model.FaultTypeBrightnessDecay, FaultName: "亮度衰减", Description: "检测亮度是否低于额定值的百分比", ThresholdMin: 60, ThresholdMax: 100, Weight: 2, FaultLevel: model.FaultLevelMinor, Duration: 60},
		{FaultType: model.FaultTypeOverTemperature, FaultName: "温度过高", Description: "检测温度是否超过安全阈值", ThresholdMin: 0, ThresholdMax: 85, Weight: 3, FaultLevel: model.FaultLevelMajor, Duration: 30},
		{FaultType: model.FaultTypePowerAbnormal, FaultName: "功率异常", Description: "检测实际功率与额定值偏差(%)", ThresholdMin: 0, ThresholdMax: 30, Weight: 3, FaultLevel: model.FaultLevelMajor, Duration: 30},
		{FaultType: model.FaultTypeLightOff, FaultName: "灯具异常熄灭", Description: "检测灯具在应该亮灯时熄灭", ThresholdMin: 0, ThresholdMax: 1, Weight: 5, FaultLevel: model.FaultLevelCritical, Duration: 0},
	}
	for _, rule := range defaultRules {
		existing, err := e.faultRepo.GetRuleByType(ctx, rule.FaultType)
		if err != nil || existing == nil {
			rule.Enabled = true
			rule.CreatedAt = time.Now()
			rule.UpdatedAt = time.Now()
			if err := e.db.WithContext(ctx).Create(rule).Error; err != nil {
				pkg.Warn(ctx, "failed to create default rule",
					zap.String("fault_type", rule.FaultType),
					zap.Error(err))
			} else {
				pkg.Info(ctx, "created default fault rule", zap.String("fault_type", rule.FaultType))
			}
		}
	}
	return nil
}

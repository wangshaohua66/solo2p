package service

import (
	"fmt"
	"time"

	"port-ops-system/internal/model"
	"port-ops-system/internal/repository"
)

type ReeferService struct {
	reeferRepo  repository.ReeferRepository
	readingRepo repository.TemperatureReadingRepository
	alertRepo   repository.AlertRepository
	containerRepo repository.ContainerRepository
}

func NewReeferService(
	reeferRepo repository.ReeferRepository,
	readingRepo repository.TemperatureReadingRepository,
	alertRepo repository.AlertRepository,
	containerRepo repository.ContainerRepository,
) *ReeferService {
	return &ReeferService{
		reeferRepo:    reeferRepo,
		readingRepo:   readingRepo,
		alertRepo:     alertRepo,
		containerRepo: containerRepo,
	}
}

func (s *ReeferService) RegisterReefer(r *model.ReeferContainer) error {
	now := time.Now()
	r.CreatedAt = now
	r.UpdatedAt = now
	r.Status = "ACTIVE"
	return s.reeferRepo.CreateReefer(r)
}

func (s *ReeferService) GetReeferByContainer(containerID int64) (*model.ReeferContainer, error) {
	return s.reeferRepo.GetReeferByContainerID(containerID)
}

func (s *ReeferService) ReportTemperature(reading *model.TemperatureReading) (*model.TemperatureAlert, *model.AlertWorkOrder, error) {
	now := time.Now()
	reading.ReceivedAt = now
	if reading.ReadingTime.IsZero() {
		reading.ReadingTime = now
	}

	reefer, err := s.reeferRepo.GetReeferByContainerID(reading.ContainerID)
	if err != nil || reefer == nil {
		if err := s.readingRepo.Create(reading); err != nil {
			return nil, nil, err
		}
		return nil, nil, nil
	}

	isAbnormal := false
	abnormalType := ""
	if reading.Temperature < reefer.MinTemperature {
		isAbnormal = true
		abnormalType = "TOO_LOW"
	} else if reading.Temperature > reefer.MaxTemperature {
		isAbnormal = true
		abnormalType = "TOO_HIGH"
	}
	reading.IsAbnormal = isAbnormal
	reading.AbnormalType = abnormalType

	reefer.CurrentTemperature = reading.Temperature
	reefer.Humidity = reading.Humidity
	lastReport := now
	reefer.LastReportTime = &lastReport
	reefer.UpdatedAt = now

	if isAbnormal {
		reefer.HasAlert = true
		reefer.AlertCount++
	}

	if err := s.reeferRepo.UpdateReefer(reefer); err != nil {
		return nil, nil, err
	}
	if err := s.readingRepo.Create(reading); err != nil {
		return nil, nil, err
	}

	if !isAbnormal {
		return nil, nil, nil
	}

	level := model.AlertLevelWarning
	threshold := reefer.MaxTemperature
	if abnormalType == "TOO_LOW" {
		threshold = reefer.MinTemperature
	}
	diff := reading.Temperature - threshold
	if diff < 0 {
		diff = -diff
	}
	if diff > 3 {
		level = model.AlertLevelCritical
	}

	alertCode := fmt.Sprintf("TA%s%010d", time.Now().Format("20060102150405"), reading.ContainerID)
	alert := &model.TemperatureAlert{
		AlertCode:   alertCode,
		ContainerID: reading.ContainerID,
		ContainerNo: reading.ContainerNo,
		Level:       level,
		AlertType:   abnormalType,
		Temperature: reading.Temperature,
		Threshold:   threshold,
		Description: fmt.Sprintf("冷藏箱%s温度异常: 当前%.1f℃, 阈值范围%.1f℃~%.1f℃",
			reading.ContainerNo, reading.Temperature, reefer.MinTemperature, reefer.MaxTemperature),
		Status:          model.AlertStatusPending,
		EscalationLevel: 0,
		StartTime:       now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.alertRepo.CreateAlert(alert); err != nil {
		return nil, nil, err
	}

	woNo := fmt.Sprintf("WO%s%010d", time.Now().Format("20060102150405"), reading.ContainerID)
	priority := 1
	if level == model.AlertLevelCritical {
		priority = 3
	} else if level == model.AlertLevelWarning {
		priority = 2
	}
	dueTime := now.Add(30 * time.Minute)
	workOrder := &model.AlertWorkOrder{
		WorkOrderNo:  woNo,
		AlertID:      alert.ID,
		ContainerID:  reading.ContainerID,
		ContainerNo:  reading.ContainerNo,
		Title:        fmt.Sprintf("冷藏箱温度异常告警 - %s", reading.ContainerNo),
		Description:  alert.Description,
		Level:        level,
		Status:       model.AlertStatusPending,
		Priority:     priority,
		NotifySent:   false,
		DueTime:      &dueTime,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.alertRepo.CreateWorkOrder(workOrder); err != nil {
		return alert, nil, err
	}

	alert.WorkOrderID = &workOrder.ID
	alert.UpdatedAt = now
	if err := s.alertRepo.UpdateAlert(alert); err != nil {
		return alert, workOrder, err
	}

	return alert, workOrder, nil
}

func (s *ReeferService) BatchReport(readings []*model.TemperatureReading) (int, error) {
	now := time.Now()
	alerts := 0
	for _, r := range readings {
		r.ReceivedAt = now
		if r.ReadingTime.IsZero() {
			r.ReadingTime = now
		}
		alert, _, err := s.ReportTemperature(r)
		if err != nil {
			continue
		}
		if alert != nil {
			alerts++
		}
	}
	return alerts, nil
}

func (s *ReeferService) ListActiveAlerts() ([]*model.TemperatureAlert, error) {
	return s.alertRepo.ListActiveAlerts()
}

func (s *ReeferService) ListWorkOrders(status model.AlertStatus) ([]*model.AlertWorkOrder, error) {
	return s.alertRepo.ListWorkOrders(status)
}

func (s *ReeferService) HandleWorkOrder(workOrderID int64, handlerName string, result string) error {
	wo, err := s.alertRepo.GetWorkOrderByID(workOrderID)
	if err != nil {
		return fmt.Errorf("获取工单失败: %w", err)
	}
	if wo == nil {
		return fmt.Errorf("工单不存在")
	}

	now := time.Now()
	wo.Status = model.AlertStatusHandled
	wo.AssigneeName = handlerName
	wo.HandleResult = result
	wo.HandleTime = &now
	wo.NotifySent = true
	wo.NotifyTime = &now
	wo.UpdatedAt = now

	if err := s.alertRepo.UpdateWorkOrder(wo); err != nil {
		return err
	}

	if wo.AlertID > 0 {
		alert, err := s.alertRepo.GetAlertByID(wo.AlertID)
		if err == nil && alert != nil {
			alert.Status = model.AlertStatusHandled
			alert.HandlerName = handlerName
			alert.EndTime = &now
			alert.UpdatedAt = now
			_ = s.alertRepo.UpdateAlert(alert)
		}
	}

	if wo.ContainerID > 0 {
		reefer, err := s.reeferRepo.GetReeferByContainerID(wo.ContainerID)
		if err == nil && reefer != nil {
			reefer.HasAlert = false
			reefer.UpdatedAt = now
			_ = s.reeferRepo.UpdateReefer(reefer)
		}
	}

	return nil
}

func (s *ReeferService) EscalateAlert(alertID int64) error {
	alert, err := s.alertRepo.GetAlertByID(alertID)
	if err != nil {
		return fmt.Errorf("获取告警失败: %w", err)
	}
	if alert == nil {
		return fmt.Errorf("告警不存在")
	}

	now := time.Now()
	alert.Status = model.AlertStatusEscalated
	alert.EscalationLevel++
	alert.UpdatedAt = now
	return s.alertRepo.UpdateAlert(alert)
}

func (s *ReeferService) GetTemperatureHistory(containerID int64, startTime, endTime time.Time) ([]*model.TemperatureReading, error) {
	return s.readingRepo.ListByContainer(containerID, startTime, endTime)
}

func (s *ReeferService) ListReefersWithAlert() ([]*model.ReeferContainer, error) {
	return s.reeferRepo.ListReefersWithAlert()
}

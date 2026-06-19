package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"port-ops-system/internal/model"
)

type ReeferRepository interface {
	CreateReefer(r *model.ReeferContainer) error
	UpdateReefer(r *model.ReeferContainer) error
	GetReeferByContainerID(id int64) (*model.ReeferContainer, error)
	GetReeferByContainerNo(no string) (*model.ReeferContainer, error)
	ListReefersWithAlert() ([]*model.ReeferContainer, error)
}

type TemperatureReadingRepository interface {
	Create(r *model.TemperatureReading) error
	BatchCreate(readings []*model.TemperatureReading) error
	ListByContainer(containerID int64, startTime, endTime time.Time) ([]*model.TemperatureReading, error)
	GetLatestByContainer(containerID int64) (*model.TemperatureReading, error)
}

type AlertRepository interface {
	CreateAlert(a *model.TemperatureAlert) error
	UpdateAlert(a *model.TemperatureAlert) error
	GetAlertByID(id int64) (*model.TemperatureAlert, error)
	GetAlertByCode(code string) (*model.TemperatureAlert, error)
	ListActiveAlerts() ([]*model.TemperatureAlert, error)
	ListByContainer(containerID int64) ([]*model.TemperatureAlert, error)
	CreateWorkOrder(wo *model.AlertWorkOrder) error
	UpdateWorkOrder(wo *model.AlertWorkOrder) error
	GetWorkOrderByID(id int64) (*model.AlertWorkOrder, error)
	ListWorkOrders(status model.AlertStatus) ([]*model.AlertWorkOrder, error)
	CreateNotification(n *model.AlertNotification) error
}

type AppointmentRepository interface {
	Create(a *model.TruckAppointment) error
	Update(a *model.TruckAppointment) error
	GetByID(id int64) (*model.TruckAppointment, error)
	GetByNo(no string) (*model.TruckAppointment, error)
	List(page, pageSize int, filters map[string]interface{}) ([]*model.TruckAppointment, int64, error)
	UpdateStatus(id int64, status model.AppointmentStatus) error
	CountByDateAndSlot(date time.Time, slot string) (int64, error)
	CheckBlacklist(entityType, entityValue string) (bool, error)
	AddBlacklist(b *model.Blacklist) error
	ListGates() ([]*model.Gate, error)
	GetGateSlot(date time.Time, gateID int64, slot string) (*model.GateSlotConfig, error)
	UpdateGateSlotQuota(id int64) error
	CreateGatePass(r *model.GatePassRecord) error
}

type DangerousRepository interface {
	CreateDangerous(d *model.DangerousGoods) error
	UpdateDangerous(d *model.DangerousGoods) error
	GetDangerousByContainerID(id int64) (*model.DangerousGoods, error)
	GetDangerousByContainerNo(no string) (*model.DangerousGoods, error)
	CreateDeclaration(d *model.CustomsDeclaration) error
	UpdateDeclaration(d *model.CustomsDeclaration) error
	GetDeclarationByID(id int64) (*model.CustomsDeclaration, error)
	GetDeclarationByNo(no string) (*model.CustomsDeclaration, error)
	ListDeclarations(page, pageSize int, status model.CustomsStatus) ([]*model.CustomsDeclaration, int64, error)
	CreateInspection(i *model.InspectionRecord) error
	UpdateInspection(i *model.InspectionRecord) error
	GetInspectionByID(id int64) (*model.InspectionRecord, error)
	CreateSyncLog(l *model.CustomsSyncLog) error
}

type StatisticsRepository interface {
	GetPortOverview() (*model.PortOverview, error)
	GetYardStatistics() ([]*model.YardStatistics, error)
	GetDailyThroughput(start, end time.Time) ([]*model.DailyThroughput, error)
	GetBerthUtilization(start, end time.Time) ([]*model.BerthUtilization, error)
	GetCranePerformance(start, end time.Time) ([]*model.CranePerformance, error)
	GetContainerTypeStats() ([]*model.ContainerTypeStats, error)
}

type BillingRepository interface {
	CreateRate(r *model.StorageRate) error
	UpdateRate(r *model.StorageRate) error
	GetRateByID(id int64) (*model.StorageRate, error)
	GetActiveRate(containerType model.ContainerType, size model.ContainerSize) (*model.StorageRate, error)
	ListRates() ([]*model.StorageRate, error)
	CreateBill(b *model.StorageBill) error
	UpdateBill(b *model.StorageBill) error
	GetBillByID(id int64) (*model.StorageBill, error)
	GetBillByNo(no string) (*model.StorageBill, error)
	ListBills(page, pageSize int, filters map[string]interface{}) ([]*model.StorageBill, int64, error)
	ListBillsByContainer(containerID int64) ([]*model.StorageBill, error)
	CreateInvoice(i *model.Invoice) error
	UpdateInvoice(i *model.Invoice) error
	GetInvoiceByID(id int64) (*model.Invoice, error)
	GetInvoiceByNo(no string) (*model.Invoice, error)
	ListInvoices(page, pageSize int, status model.BillingStatus) ([]*model.Invoice, int64, error)
	CreatePayment(p *model.Payment) error
	ListPayments(invoiceID int64) ([]*model.Payment, error)
}

type reeferRepo struct {
	db *gorm.DB
}

func NewReeferRepository(r *Repository) ReeferRepository {
	return &reeferRepo{db: r.db}
}

func (r *reeferRepo) CreateReefer(rc *model.ReeferContainer) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(rc).Error
}

func (r *reeferRepo) UpdateReefer(rc *model.ReeferContainer) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(rc).Error
}

func (r *reeferRepo) GetReeferByContainerID(id int64) (*model.ReeferContainer, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var rc model.ReeferContainer
	err := r.db.Where("container_id = ?", id).First(&rc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &rc, err
}

func (r *reeferRepo) GetReeferByContainerNo(no string) (*model.ReeferContainer, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var rc model.ReeferContainer
	err := r.db.Where("container_no = ?", no).First(&rc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &rc, err
}

func (r *reeferRepo) ListReefersWithAlert() ([]*model.ReeferContainer, error) {
	if r.db == nil {
		return []*model.ReeferContainer{}, nil
	}
	var reefers []*model.ReeferContainer
	err := r.db.Where("has_alert = ?", true).Find(&reefers).Error
	return reefers, err
}

type tempReadingRepo struct {
	db *gorm.DB
}

func NewTemperatureReadingRepository(r *Repository) TemperatureReadingRepository {
	return &tempReadingRepo{db: r.db}
}

func (r *tempReadingRepo) Create(tr *model.TemperatureReading) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(tr).Error
}

func (r *tempReadingRepo) BatchCreate(readings []*model.TemperatureReading) error {
	if r.db == nil {
		return nil
	}
	return r.db.CreateInBatches(readings, 100).Error
}

func (r *tempReadingRepo) ListByContainer(containerID int64, startTime, endTime time.Time) ([]*model.TemperatureReading, error) {
	if r.db == nil {
		return []*model.TemperatureReading{}, nil
	}
	var readings []*model.TemperatureReading
	err := r.db.Where("container_id = ? AND reading_time BETWEEN ? AND ?", containerID, startTime, endTime).
		Order("reading_time ASC").Find(&readings).Error
	return readings, err
}

func (r *tempReadingRepo) GetLatestByContainer(containerID int64) (*model.TemperatureReading, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var tr model.TemperatureReading
	err := r.db.Where("container_id = ?", containerID).Order("reading_time DESC").First(&tr).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &tr, err
}

type alertRepo struct {
	db *gorm.DB
}

func NewAlertRepository(r *Repository) AlertRepository {
	return &alertRepo{db: r.db}
}

func (r *alertRepo) CreateAlert(a *model.TemperatureAlert) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(a).Error
}

func (r *alertRepo) UpdateAlert(a *model.TemperatureAlert) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(a).Error
}

func (r *alertRepo) GetAlertByID(id int64) (*model.TemperatureAlert, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var a model.TemperatureAlert
	err := r.db.First(&a, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &a, err
}

func (r *alertRepo) GetAlertByCode(code string) (*model.TemperatureAlert, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var a model.TemperatureAlert
	err := r.db.Where("alert_code = ?", code).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &a, err
}

func (r *alertRepo) ListActiveAlerts() ([]*model.TemperatureAlert, error) {
	if r.db == nil {
		return []*model.TemperatureAlert{}, nil
	}
	var alerts []*model.TemperatureAlert
	err := r.db.Where("status IN ?", []model.AlertStatus{model.AlertStatusPending, model.AlertStatusHandled, model.AlertStatusEscalated}).
		Order("created_at DESC").Find(&alerts).Error
	return alerts, err
}

func (r *alertRepo) ListByContainer(containerID int64) ([]*model.TemperatureAlert, error) {
	if r.db == nil {
		return []*model.TemperatureAlert{}, nil
	}
	var alerts []*model.TemperatureAlert
	err := r.db.Where("container_id = ?", containerID).Order("created_at DESC").Find(&alerts).Error
	return alerts, err
}

func (r *alertRepo) CreateWorkOrder(wo *model.AlertWorkOrder) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(wo).Error
}

func (r *alertRepo) UpdateWorkOrder(wo *model.AlertWorkOrder) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(wo).Error
}

func (r *alertRepo) GetWorkOrderByID(id int64) (*model.AlertWorkOrder, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var wo model.AlertWorkOrder
	err := r.db.First(&wo, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &wo, err
}

func (r *alertRepo) ListWorkOrders(status model.AlertStatus) ([]*model.AlertWorkOrder, error) {
	if r.db == nil {
		return []*model.AlertWorkOrder{}, nil
	}
	var wos []*model.AlertWorkOrder
	q := r.db.Model(&model.AlertWorkOrder{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	err := q.Order("created_at DESC").Find(&wos).Error
	return wos, err
}

func (r *alertRepo) CreateNotification(n *model.AlertNotification) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(n).Error
}

type appointmentRepo struct {
	db *gorm.DB
}

func NewAppointmentRepository(r *Repository) AppointmentRepository {
	return &appointmentRepo{db: r.db}
}

func (r *appointmentRepo) Create(a *model.TruckAppointment) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(a).Error
}

func (r *appointmentRepo) Update(a *model.TruckAppointment) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(a).Error
}

func (r *appointmentRepo) GetByID(id int64) (*model.TruckAppointment, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var a model.TruckAppointment
	err := r.db.First(&a, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &a, err
}

func (r *appointmentRepo) GetByNo(no string) (*model.TruckAppointment, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var a model.TruckAppointment
	err := r.db.Where("appointment_no = ?", no).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &a, err
}

func (r *appointmentRepo) List(page, pageSize int, filters map[string]interface{}) ([]*model.TruckAppointment, int64, error) {
	if r.db == nil {
		return []*model.TruckAppointment{}, 0, nil
	}
	query := r.db.Model(&model.TruckAppointment{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []*model.TruckAppointment
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *appointmentRepo) UpdateStatus(id int64, status model.AppointmentStatus) error {
	if r.db == nil {
		return nil
	}
	return r.db.Model(&model.TruckAppointment{}).Where("id = ?", id).Update("status", status).Error
}

func (r *appointmentRepo) CountByDateAndSlot(date time.Time, slot string) (int64, error) {
	if r.db == nil {
		return 0, nil
	}
	var count int64
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)
	err := r.db.Model(&model.TruckAppointment{}).
		Where("appointment_date >= ? AND appointment_date < ? AND time_slot = ? AND status NOT IN ?",
			startOfDay, endOfDay, slot, []model.AppointmentStatus{model.AppointmentStatusCancelled, model.AppointmentStatusTimeout}).
		Count(&count).Error
	return count, err
}

func (r *appointmentRepo) CheckBlacklist(entityType, entityValue string) (bool, error) {
	if r.db == nil {
		return false, nil
	}
	var count int64
	now := time.Now()
	err := r.db.Model(&model.Blacklist{}).
		Where("entity_type = ? AND entity_value = ? AND is_active = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)",
			entityType, entityValue, true, now, now).
		Count(&count).Error
	return count > 0, err
}

func (r *appointmentRepo) AddBlacklist(b *model.Blacklist) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(b).Error
}

func (r *appointmentRepo) ListGates() ([]*model.Gate, error) {
	if r.db == nil {
		return []*model.Gate{}, nil
	}
	var gates []*model.Gate
	err := r.db.Where("is_active = ?", true).Find(&gates).Error
	return gates, err
}

func (r *appointmentRepo) GetGateSlot(date time.Time, gateID int64, slot string) (*model.GateSlotConfig, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	var gs model.GateSlotConfig
	err := r.db.Where("date = ? AND gate_id = ? AND time_slot = ?", startOfDay, gateID, slot).First(&gs).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &gs, err
}

func (r *appointmentRepo) UpdateGateSlotQuota(id int64) error {
	if r.db == nil {
		return nil
	}
	return r.db.Model(&model.GateSlotConfig{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"used_quota":      gorm.Expr("used_quota + 1"),
			"remaining_quota": gorm.Expr("remaining_quota - 1"),
		}).Error
}

func (r *appointmentRepo) CreateGatePass(gr *model.GatePassRecord) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(gr).Error
}

type dangerousRepo struct {
	db *gorm.DB
}

func NewDangerousRepository(r *Repository) DangerousRepository {
	return &dangerousRepo{db: r.db}
}

func (r *dangerousRepo) CreateDangerous(d *model.DangerousGoods) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(d).Error
}

func (r *dangerousRepo) UpdateDangerous(d *model.DangerousGoods) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(d).Error
}

func (r *dangerousRepo) GetDangerousByContainerID(id int64) (*model.DangerousGoods, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var d model.DangerousGoods
	err := r.db.Where("container_id = ?", id).First(&d).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &d, err
}

func (r *dangerousRepo) GetDangerousByContainerNo(no string) (*model.DangerousGoods, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var d model.DangerousGoods
	err := r.db.Where("container_no = ?", no).First(&d).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &d, err
}

func (r *dangerousRepo) CreateDeclaration(d *model.CustomsDeclaration) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(d).Error
}

func (r *dangerousRepo) UpdateDeclaration(d *model.CustomsDeclaration) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(d).Error
}

func (r *dangerousRepo) GetDeclarationByID(id int64) (*model.CustomsDeclaration, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var d model.CustomsDeclaration
	err := r.db.First(&d, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &d, err
}

func (r *dangerousRepo) GetDeclarationByNo(no string) (*model.CustomsDeclaration, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var d model.CustomsDeclaration
	err := r.db.Where("declaration_no = ?", no).First(&d).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &d, err
}

func (r *dangerousRepo) ListDeclarations(page, pageSize int, status model.CustomsStatus) ([]*model.CustomsDeclaration, int64, error) {
	if r.db == nil {
		return []*model.CustomsDeclaration{}, 0, nil
	}
	q := r.db.Model(&model.CustomsDeclaration{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []*model.CustomsDeclaration
	offset := (page - 1) * pageSize
	err := q.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *dangerousRepo) CreateInspection(i *model.InspectionRecord) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(i).Error
}

func (r *dangerousRepo) UpdateInspection(i *model.InspectionRecord) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(i).Error
}

func (r *dangerousRepo) GetInspectionByID(id int64) (*model.InspectionRecord, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var i model.InspectionRecord
	err := r.db.First(&i, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &i, err
}

func (r *dangerousRepo) CreateSyncLog(l *model.CustomsSyncLog) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(l).Error
}

type statisticsRepo struct {
	db *gorm.DB
}

func NewStatisticsRepository(r *Repository) StatisticsRepository {
	return &statisticsRepo{db: r.db}
}

func (r *statisticsRepo) GetPortOverview() (*model.PortOverview, error) {
	if r.db == nil {
		return &model.PortOverview{}, nil
	}
	overview := &model.PortOverview{}
	var totalYards, totalSlots, usedSlots int64
	r.db.Model(&model.Yard{}).Count(&totalYards)
	r.db.Model(&model.YardSlot{}).Count(&totalSlots)
	r.db.Model(&model.YardSlot{}).Where("is_occupied = ?", true).Count(&usedSlots)
	overview.TotalYards = int(totalYards)
	overview.TotalSlots = int(totalSlots)
	overview.UsedSlots = int(usedSlots)
	overview.TotalCapacity = overview.TotalSlots
	if overview.TotalSlots > 0 {
		overview.OverallOccupancy = float64(overview.UsedSlots) / float64(overview.TotalSlots) * 100
	}
	var totalContainers, inYardContainers, activeBerths, occupiedBerths int64
	var activeCranes, workingCranes, activeAlerts, criticalAlerts int64
	r.db.Model(&model.Container{}).Count(&totalContainers)
	r.db.Model(&model.Container{}).Where("status = ?", model.ContainerStatusInYard).Count(&inYardContainers)
	r.db.Model(&model.Berth{}).Count(&activeBerths)
	r.db.Model(&model.Berth{}).Where("status = ?", model.BerthStatusOccupied).Count(&occupiedBerths)
	r.db.Model(&model.QuayCrane{}).Count(&activeCranes)
	r.db.Model(&model.QuayCrane{}).Where("status = ?", model.QuayCraneStatusWorking).Count(&workingCranes)
	r.db.Model(&model.TemperatureAlert{}).Where("status IN ?", []model.AlertStatus{model.AlertStatusPending, model.AlertStatusEscalated}).Count(&activeAlerts)
	r.db.Model(&model.TemperatureAlert{}).Where("level = ? AND status IN ?", model.AlertLevelCritical, []model.AlertStatus{model.AlertStatusPending, model.AlertStatusEscalated}).Count(&criticalAlerts)
	overview.TotalContainers = int(totalContainers)
	overview.InYardContainers = int(inYardContainers)
	overview.ActiveBerths = int(activeBerths)
	overview.OccupiedBerths = int(occupiedBerths)
	overview.ActiveCranes = int(activeCranes)
	overview.WorkingCranes = int(workingCranes)
	overview.ActiveAlerts = int(activeAlerts)
	overview.CriticalAlerts = int(criticalAlerts)
	return overview, nil
}

func (r *statisticsRepo) GetYardStatistics() ([]*model.YardStatistics, error) {
	if r.db == nil {
		return []*model.YardStatistics{}, nil
	}
	var yards []*model.Yard
	if err := r.db.Find(&yards).Error; err != nil {
		return nil, err
	}
	result := make([]*model.YardStatistics, 0, len(yards))
	for _, y := range yards {
		var usedCount int64
		r.db.Model(&model.YardSlot{}).Where("yard_id = ? AND is_occupied = ?", y.ID, true).Count(&usedCount)
		var normalCount, reeferCount, dangerousCount, oversizeCount int64
		r.db.Model(&model.Container{}).Where("yard_id = ? AND status = ? AND container_type = ?", y.ID, model.ContainerStatusInYard, model.ContainerTypeNormal).Count(&normalCount)
		r.db.Model(&model.Container{}).Where("yard_id = ? AND status = ? AND container_type = ?", y.ID, model.ContainerStatusInYard, model.ContainerTypeReefer).Count(&reeferCount)
		r.db.Model(&model.Container{}).Where("yard_id = ? AND status = ? AND container_type = ?", y.ID, model.ContainerStatusInYard, model.ContainerTypeDangerous).Count(&dangerousCount)
		r.db.Model(&model.Container{}).Where("yard_id = ? AND status = ? AND container_type = ?", y.ID, model.ContainerStatusInYard, model.ContainerTypeOversize).Count(&oversizeCount)
		occupancy := 0.0
		if y.Capacity > 0 {
			occupancy = float64(usedCount) / float64(y.Capacity) * 100
		}
		result = append(result, &model.YardStatistics{
			YardID:         y.ID,
			YardCode:       y.YardCode,
			YardName:       y.YardName,
			Zone:           y.Zone,
			ContainerType:  y.ContainerType,
			TotalCapacity:  y.Capacity,
			UsedSlots:      int(usedCount),
			AvailableSlots: y.Capacity - int(usedCount),
			OccupancyRate:  occupancy,
			ContainerCount: int(normalCount + reeferCount + dangerousCount + oversizeCount),
			NormalCount:    int(normalCount),
			ReeferCount:    int(reeferCount),
			DangerousCount: int(dangerousCount),
			OversizeCount:  int(oversizeCount),
		})
	}
	return result, nil
}

func (r *statisticsRepo) GetDailyThroughput(start, end time.Time) ([]*model.DailyThroughput, error) {
	if r.db == nil {
		return []*model.DailyThroughput{}, nil
	}
	return []*model.DailyThroughput{}, nil
}

func (r *statisticsRepo) GetBerthUtilization(start, end time.Time) ([]*model.BerthUtilization, error) {
	if r.db == nil {
		return []*model.BerthUtilization{}, nil
	}
	return []*model.BerthUtilization{}, nil
}

func (r *statisticsRepo) GetCranePerformance(start, end time.Time) ([]*model.CranePerformance, error) {
	if r.db == nil {
		return []*model.CranePerformance{}, nil
	}
	return []*model.CranePerformance{}, nil
}

func (r *statisticsRepo) GetContainerTypeStats() ([]*model.ContainerTypeStats, error) {
	if r.db == nil {
		return []*model.ContainerTypeStats{}, nil
	}
	types := []model.ContainerType{model.ContainerTypeNormal, model.ContainerTypeReefer, model.ContainerTypeDangerous, model.ContainerTypeOversize}
	result := make([]*model.ContainerTypeStats, 0)
	var total int64
	r.db.Model(&model.Container{}).Where("status = ?", model.ContainerStatusInYard).Count(&total)
	for _, t := range types {
		var count int64
		r.db.Model(&model.Container{}).Where("status = ? AND container_type = ?", model.ContainerStatusInYard, t).Count(&count)
		pct := 0.0
		if total > 0 {
			pct = float64(count) / float64(total) * 100
		}
		result = append(result, &model.ContainerTypeStats{
			ContainerType: t,
			Count:         int(count),
			Percentage:    pct,
		})
	}
	return result, nil
}

type billingRepo struct {
	db *gorm.DB
}

func NewBillingRepository(r *Repository) BillingRepository {
	return &billingRepo{db: r.db}
}

func (r *billingRepo) CreateRate(rate *model.StorageRate) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(rate).Error
}

func (r *billingRepo) UpdateRate(rate *model.StorageRate) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(rate).Error
}

func (r *billingRepo) GetRateByID(id int64) (*model.StorageRate, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var rate model.StorageRate
	err := r.db.First(&rate, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &rate, err
}

func (r *billingRepo) GetActiveRate(containerType model.ContainerType, size model.ContainerSize) (*model.StorageRate, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var rate model.StorageRate
	now := time.Now()
	err := r.db.Where("is_active = ? AND container_type = ? AND container_size = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)",
		true, containerType, size, now, now).First(&rate).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &rate, err
}

func (r *billingRepo) ListRates() ([]*model.StorageRate, error) {
	if r.db == nil {
		return []*model.StorageRate{}, nil
	}
	var rates []*model.StorageRate
	err := r.db.Order("created_at DESC").Find(&rates).Error
	return rates, err
}

func (r *billingRepo) CreateBill(b *model.StorageBill) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(b).Error
}

func (r *billingRepo) UpdateBill(b *model.StorageBill) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(b).Error
}

func (r *billingRepo) GetBillByID(id int64) (*model.StorageBill, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var b model.StorageBill
	err := r.db.First(&b, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &b, err
}

func (r *billingRepo) GetBillByNo(no string) (*model.StorageBill, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var b model.StorageBill
	err := r.db.Where("bill_no = ?", no).First(&b).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &b, err
}

func (r *billingRepo) ListBills(page, pageSize int, filters map[string]interface{}) ([]*model.StorageBill, int64, error) {
	if r.db == nil {
		return []*model.StorageBill{}, 0, nil
	}
	query := r.db.Model(&model.StorageBill{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []*model.StorageBill
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *billingRepo) ListBillsByContainer(containerID int64) ([]*model.StorageBill, error) {
	if r.db == nil {
		return []*model.StorageBill{}, nil
	}
	var bills []*model.StorageBill
	err := r.db.Where("container_id = ?", containerID).Order("created_at DESC").Find(&bills).Error
	return bills, err
}

func (r *billingRepo) CreateInvoice(i *model.Invoice) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(i).Error
}

func (r *billingRepo) UpdateInvoice(i *model.Invoice) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(i).Error
}

func (r *billingRepo) GetInvoiceByID(id int64) (*model.Invoice, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var i model.Invoice
	err := r.db.First(&i, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &i, err
}

func (r *billingRepo) GetInvoiceByNo(no string) (*model.Invoice, error) {
	if r.db == nil {
		return nil, errors.New("database not connected")
	}
	var i model.Invoice
	err := r.db.Where("invoice_no = ?", no).First(&i).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &i, err
}

func (r *billingRepo) ListInvoices(page, pageSize int, status model.BillingStatus) ([]*model.Invoice, int64, error) {
	if r.db == nil {
		return []*model.Invoice{}, 0, nil
	}
	q := r.db.Model(&model.Invoice{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []*model.Invoice
	offset := (page - 1) * pageSize
	err := q.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *billingRepo) CreatePayment(p *model.Payment) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(p).Error
}

func (r *billingRepo) ListPayments(invoiceID int64) ([]*model.Payment, error) {
	if r.db == nil {
		return []*model.Payment{}, nil
	}
	var payments []*model.Payment
	err := r.db.Where("invoice_id = ?", invoiceID).Order("created_at DESC").Find(&payments).Error
	return payments, err
}

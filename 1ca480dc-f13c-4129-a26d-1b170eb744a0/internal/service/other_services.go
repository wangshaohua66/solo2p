package service

import (
	"fmt"
	"time"

	"port-ops-system/internal/model"
	"port-ops-system/internal/repository"
)

type AppointmentService struct {
	appointmentRepo repository.AppointmentRepository
}

func NewAppointmentService(appointmentRepo repository.AppointmentRepository) *AppointmentService {
	return &AppointmentService{appointmentRepo: appointmentRepo}
}

func (s *AppointmentService) CreateAppointment(a *model.TruckAppointment) error {
	blacklisted, err := s.appointmentRepo.CheckBlacklist("TRUCK", a.TruckPlateNo)
	if err != nil {
		return fmt.Errorf("黑名单检查失败: %w", err)
	}
	if blacklisted {
		return fmt.Errorf("车辆在黑名单中，禁止预约")
	}
	blacklisted, err = s.appointmentRepo.CheckBlacklist("COMPANY", a.CompanyName)
	if err != nil {
		return fmt.Errorf("黑名单检查失败: %w", err)
	}
	if blacklisted {
		return fmt.Errorf("企业在黑名单中，禁止预约")
	}

	slot, err := s.appointmentRepo.GetGateSlot(a.AppointmentDate, a.GateID, a.TimeSlot)
	if err != nil {
		return fmt.Errorf("获取时段配置失败: %w", err)
	}
	if slot == nil || slot.RemainingQuota <= 0 {
		return fmt.Errorf("该时段预约已满")
	}

	now := time.Now()
	a.CreatedAt = now
	a.UpdatedAt = now
	if a.Status == "" {
		a.Status = model.AppointmentStatusConfirmed
	}
	a.AppointmentNo = fmt.Sprintf("APT%s%06d", now.Format("20060102150405"), a.GateID)
	expire := a.AppointmentDate.Add(30 * time.Minute)
	a.ExpireTime = &expire
	a.IsBlacklisted = false

	if err := s.appointmentRepo.Create(a); err != nil {
		return fmt.Errorf("创建预约失败: %w", err)
	}

	if slot != nil {
		_ = s.appointmentRepo.UpdateGateSlotQuota(slot.ID)
	}

	return nil
}

func (s *AppointmentService) GetAppointment(id int64) (*model.TruckAppointment, error) {
	return s.appointmentRepo.GetByID(id)
}

func (s *AppointmentService) GetAppointmentByNo(no string) (*model.TruckAppointment, error) {
	return s.appointmentRepo.GetByNo(no)
}

func (s *AppointmentService) ListAppointments(page, pageSize int, filters map[string]interface{}) ([]*model.TruckAppointment, int64, error) {
	return s.appointmentRepo.List(page, pageSize, filters)
}

func (s *AppointmentService) CheckIn(id int64) error {
	a, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("获取预约失败: %w", err)
	}
	if a == nil {
		return fmt.Errorf("预约不存在")
	}

	now := time.Now()
	a.CheckInTime = &now
	a.Status = model.AppointmentStatusCheckedIn
	a.UpdatedAt = now

	return s.appointmentRepo.Update(a)
}

func (s *AppointmentService) CheckOut(id int64) error {
	a, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("获取预约失败: %w", err)
	}
	if a == nil {
		return fmt.Errorf("预约不存在")
	}

	now := time.Now()
	a.CheckOutTime = &now
	a.Status = model.AppointmentStatusCompleted
	a.UpdatedAt = now

	pass := &model.GatePassRecord{
		AppointmentID: a.ID,
		AppointmentNo: a.AppointmentNo,
		GateID:        a.GateID,
		GateCode:      a.GateCode,
		TruckPlateNo:  a.TruckPlateNo,
		ContainerNo:   a.ContainerNo,
		PassType:      "OUT",
		PassTime:      now,
		VerifyResult:  "PASS",
	}
	_ = s.appointmentRepo.CreateGatePass(pass)

	return s.appointmentRepo.Update(a)
}

func (s *AppointmentService) Cancel(id int64) error {
	a, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("获取预约失败: %w", err)
	}
	if a == nil {
		return fmt.Errorf("预约不存在")
	}
	a.Status = model.AppointmentStatusCancelled
	a.UpdatedAt = time.Now()
	return s.appointmentRepo.Update(a)
}

func (s *AppointmentService) Verify(appointmentNo string, truckPlateNo string) (*model.TruckAppointment, error) {
	a, err := s.appointmentRepo.GetByNo(appointmentNo)
	if err != nil {
		return nil, fmt.Errorf("获取预约失败: %w", err)
	}
	if a == nil {
		return nil, fmt.Errorf("预约不存在")
	}
	if a.TruckPlateNo != truckPlateNo {
		return nil, fmt.Errorf("车牌号与预约不符")
	}
	now := time.Now()
	if a.ExpireTime != nil && now.After(*a.ExpireTime) && a.Status == model.AppointmentStatusConfirmed {
		a.Status = model.AppointmentStatusTimeout
		a.UpdatedAt = now
		_ = s.appointmentRepo.Update(a)
		return nil, fmt.Errorf("预约已超时")
	}
	if a.Status != model.AppointmentStatusConfirmed && a.Status != model.AppointmentStatusCheckedIn {
		return nil, fmt.Errorf("预约状态异常: %s", a.Status)
	}
	return a, nil
}

func (s *AppointmentService) ListGates() ([]*model.Gate, error) {
	return s.appointmentRepo.ListGates()
}

func (s *AppointmentService) AddToBlacklist(b *model.Blacklist) error {
	now := time.Now()
	b.CreatedAt = now
	b.UpdatedAt = now
	if b.EffectiveFrom.IsZero() {
		b.EffectiveFrom = now
	}
	b.IsActive = true
	return s.appointmentRepo.AddBlacklist(b)
}

type DangerousService struct {
	dangerousRepo repository.DangerousRepository
}

func NewDangerousService(dangerousRepo repository.DangerousRepository) *DangerousService {
	return &DangerousService{dangerousRepo: dangerousRepo}
}

func (s *DangerousService) CreateDangerousGoods(d *model.DangerousGoods) error {
	now := time.Now()
	d.CreatedAt = now
	d.UpdatedAt = now
	d.CustomsStatus = model.CustomsStatusPending
	d.CustomsDeclared = false
	return s.dangerousRepo.CreateDangerous(d)
}

func (s *DangerousService) GetDangerousByContainer(containerID int64) (*model.DangerousGoods, error) {
	return s.dangerousRepo.GetDangerousByContainerID(containerID)
}

func (s *DangerousService) SubmitDeclaration(d *model.CustomsDeclaration) error {
	now := time.Now()
	d.CreatedAt = now
	d.UpdatedAt = now
	d.Status = model.CustomsStatusDeclared
	d.SubmitTime = &now
	if d.DeclarationNo == "" {
		d.DeclarationNo = fmt.Sprintf("CUS%s%06d", now.Format("20060102150405"), d.ContainerID)
	}

	if err := s.dangerousRepo.CreateDeclaration(d); err != nil {
		return err
	}

	dg, err := s.dangerousRepo.GetDangerousByContainerID(d.ContainerID)
	if err == nil && dg != nil {
		dg.CustomsStatus = model.CustomsStatusDeclared
		dg.CustomsDeclared = true
		dg.UpdatedAt = now
		_ = s.dangerousRepo.UpdateDangerous(dg)
	}

	syncLog := &model.CustomsSyncLog{
		LogType:       "DECLARATION",
		DeclarationID: d.ID,
		ContainerNo:   d.ContainerNo,
		Direction:     "OUT",
		APIEndpoint:   "/customs/declare",
		StatusCode:    200,
		Success:       true,
		CreatedAt:     now,
	}
	_ = s.dangerousRepo.CreateSyncLog(syncLog)

	return nil
}

func (s *DangerousService) GetDeclaration(id int64) (*model.CustomsDeclaration, error) {
	return s.dangerousRepo.GetDeclarationByID(id)
}

func (s *DangerousService) ListDeclarations(page, pageSize int, status model.CustomsStatus) ([]*model.CustomsDeclaration, int64, error) {
	return s.dangerousRepo.ListDeclarations(page, pageSize, status)
}

func (s *DangerousService) UpdateDeclarationStatus(id int64, status model.CustomsStatus, inspectNotice, result string) error {
	d, err := s.dangerousRepo.GetDeclarationByID(id)
	if err != nil {
		return fmt.Errorf("获取申报单失败: %w", err)
	}
	if d == nil {
		return fmt.Errorf("申报单不存在")
	}

	now := time.Now()
	d.Status = status
	d.UpdatedAt = now

	switch status {
	case model.CustomsStatusInspecting:
		d.InspectionNotice = inspectNotice
		if d.InspectionTime == nil {
			d.InspectionTime = &now
		}
	case model.CustomsStatusPassed, model.CustomsStatusRejected:
		d.InspectionResult = result
		d.ReleaseTime = &now
	}

	if err := s.dangerousRepo.UpdateDeclaration(d); err != nil {
		return err
	}

	dg, err := s.dangerousRepo.GetDangerousByContainerID(d.ContainerID)
	if err == nil && dg != nil {
		dg.CustomsStatus = status
		if status == model.CustomsStatusInspecting {
			dg.InspectionRequired = true
			dg.InspectionStatus = "IN_PROGRESS"
		} else if status == model.CustomsStatusPassed {
			dg.InspectionStatus = "PASSED"
		} else if status == model.CustomsStatusRejected {
			dg.InspectionStatus = "REJECTED"
		}
		dg.UpdatedAt = now
		_ = s.dangerousRepo.UpdateDangerous(dg)
	}

	return nil
}

func (s *DangerousService) CreateInspection(i *model.InspectionRecord) error {
	now := time.Now()
	i.CreatedAt = now
	i.UpdatedAt = now
	if i.InspectionNo == "" {
		i.InspectionNo = fmt.Sprintf("INS%s%06d", now.Format("20060102150405"), i.ContainerID)
	}
	return s.dangerousRepo.CreateInspection(i)
}

type StatisticsService struct {
	statsRepo repository.StatisticsRepository
}

func NewStatisticsService(statsRepo repository.StatisticsRepository) *StatisticsService {
	return &StatisticsService{statsRepo: statsRepo}
}

func (s *StatisticsService) GetPortOverview() (*model.PortOverview, error) {
	return s.statsRepo.GetPortOverview()
}

func (s *StatisticsService) GetYardStatistics() ([]*model.YardStatistics, error) {
	return s.statsRepo.GetYardStatistics()
}

func (s *StatisticsService) GetDailyThroughput(start, end time.Time) ([]*model.DailyThroughput, error) {
	return s.statsRepo.GetDailyThroughput(start, end)
}

func (s *StatisticsService) GetBerthUtilization(start, end time.Time) ([]*model.BerthUtilization, error) {
	return s.statsRepo.GetBerthUtilization(start, end)
}

func (s *StatisticsService) GetCranePerformance(start, end time.Time) ([]*model.CranePerformance, error) {
	return s.statsRepo.GetCranePerformance(start, end)
}

func (s *StatisticsService) GetContainerTypeStats() ([]*model.ContainerTypeStats, error) {
	return s.statsRepo.GetContainerTypeStats()
}

type BillingService struct {
	billingRepo repository.BillingRepository
	containerRepo repository.ContainerRepository
}

func NewBillingService(billingRepo repository.BillingRepository, containerRepo repository.ContainerRepository) *BillingService {
	return &BillingService{
		billingRepo:   billingRepo,
		containerRepo: containerRepo,
	}
}

func (s *BillingService) CalculateStorageFee(containerID int64) (*model.StorageBill, error) {
	container, err := s.containerRepo.GetByID(containerID)
	if err != nil {
		return nil, fmt.Errorf("获取集装箱失败: %w", err)
	}
	if container == nil {
		return nil, fmt.Errorf("集装箱不存在")
	}

	rate, err := s.billingRepo.GetActiveRate(container.ContainerType, container.Size)
	if err != nil {
		return nil, fmt.Errorf("获取费率失败: %w", err)
	}
	if rate == nil {
		return nil, fmt.Errorf("未找到对应费率")
	}

	var inTime time.Time
	if container.InTime != nil {
		inTime = *container.InTime
	} else {
		inTime = container.CreatedAt
	}

	var outTime time.Time
	if container.OutTime != nil {
		outTime = *container.OutTime
	} else {
		outTime = time.Now()
	}

	totalDays := int(outTime.Sub(inTime).Hours()/24) + 1
	freeDays := rate.FreeDays
	if container.FreeDays > freeDays {
		freeDays = container.FreeDays
	}

	chargeableDays := totalDays - freeDays
	if chargeableDays < 0 {
		chargeableDays = 0
	}

	day1To7 := 0
	day8To15 := 0
	day16Plus := 0

	if chargeableDays > 0 {
		if chargeableDays <= 7 {
			day1To7 = chargeableDays
		} else {
			day1To7 = 7
			if chargeableDays <= 15 {
				day8To15 = chargeableDays - 7
			} else {
				day8To15 = 8
				day16Plus = chargeableDays - 15
			}
		}
	}

	baseAmount := float64(day1To7)*rate.Day1To7Rate +
		float64(day8To15)*rate.Day8To15Rate +
		float64(day16Plus)*rate.Day16PlusRate

	extraAmount := 0.0
	if container.ContainerType == model.ContainerTypeReefer {
		extraAmount = float64(chargeableDays) * rate.ReeferExtraRate
	} else if container.ContainerType == model.ContainerTypeDangerous {
		extraAmount = float64(chargeableDays) * rate.DangerousExtraRate
	}

	now := time.Now()
	billNo := fmt.Sprintf("STO%s%010d", now.Format("20060102150405"), containerID)
	bill := &model.StorageBill{
		BillNo:         billNo,
		BillingPeriod:  now.Format("2006-01"),
		ContainerID:    containerID,
		ContainerNo:    container.ContainerNo,
		ContainerType:  container.ContainerType,
		ContainerSize:  container.Size,
		CustomerName:   container.Consignee,
		ShippingLine:   container.ShippingLine,
		InTime:         container.InTime,
		OutTime:        container.OutTime,
		FreeDays:       freeDays,
		ChargeableDays: chargeableDays,
		Day1To7Days:    day1To7,
		Day8To15Days:   day8To15,
		Day16PlusDays:  day16Plus,
		RateID:         rate.ID,
		Day1To7Rate:    rate.Day1To7Rate,
		Day8To15Rate:   rate.Day8To15Rate,
		Day16PlusRate:  rate.Day16PlusRate,
		BaseAmount:     baseAmount,
		ExtraAmount:    extraAmount,
		TotalAmount:    baseAmount + extraAmount,
		Currency:       rate.Currency,
		Status:         model.BillingStatusUnpaid,
		BillingTime:    now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	return bill, nil
}

func (s *BillingService) CreateBill(bill *model.StorageBill) error {
	return s.billingRepo.CreateBill(bill)
}

func (s *BillingService) GetBill(id int64) (*model.StorageBill, error) {
	return s.billingRepo.GetBillByID(id)
}

func (s *BillingService) ListBills(page, pageSize int, filters map[string]interface{}) ([]*model.StorageBill, int64, error) {
	return s.billingRepo.ListBills(page, pageSize, filters)
}

func (s *BillingService) CreateRate(rate *model.StorageRate) error {
	now := time.Now()
	rate.CreatedAt = now
	rate.UpdatedAt = now
	if rate.EffectiveFrom.IsZero() {
		rate.EffectiveFrom = now
	}
	return s.billingRepo.CreateRate(rate)
}

func (s *BillingService) ListRates() ([]*model.StorageRate, error) {
	return s.billingRepo.ListRates()
}

func (s *BillingService) CreateInvoice(invoice *model.Invoice) error {
	now := time.Now()
	invoice.CreatedAt = now
	invoice.UpdatedAt = now
	invoice.IssueDate = now
	if invoice.InvoiceNo == "" {
		invoice.InvoiceNo = fmt.Sprintf("INV%s%06d", now.Format("20060102150405"), invoice.CustomerID)
	}
	if invoice.Status == "" {
		invoice.Status = model.BillingStatusUnpaid
	}
	return s.billingRepo.CreateInvoice(invoice)
}

func (s *BillingService) GetInvoice(id int64) (*model.Invoice, error) {
	return s.billingRepo.GetInvoiceByID(id)
}

func (s *BillingService) ListInvoices(page, pageSize int, status model.BillingStatus) ([]*model.Invoice, int64, error) {
	return s.billingRepo.ListInvoices(page, pageSize, status)
}

func (s *BillingService) RecordPayment(p *model.Payment) error {
	now := time.Now()
	p.CreatedAt = now
	if p.PaymentNo == "" {
		p.PaymentNo = fmt.Sprintf("PAY%s%06d", now.Format("20060102150405"), p.InvoiceID)
	}
	if p.PaymentTime.IsZero() {
		p.PaymentTime = now
	}

	if err := s.billingRepo.CreatePayment(p); err != nil {
		return err
	}

	invoice, err := s.billingRepo.GetInvoiceByID(p.InvoiceID)
	if err == nil && invoice != nil {
		invoice.PaidAmount += p.Amount
		invoice.Outstanding = invoice.TotalAmount - invoice.PaidAmount
		if invoice.Outstanding <= 0 {
			invoice.Status = model.BillingStatusPaid
			invoice.PaidDate = &now
		} else if invoice.PaidAmount > 0 {
			invoice.Status = model.BillingStatusPartial
		}
		invoice.UpdatedAt = now
		_ = s.billingRepo.UpdateInvoice(invoice)
	}

	return nil
}

package service

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"smart-lighting-api/model"
	"smart-lighting-api/pkg"
	"smart-lighting-api/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ScheduleService struct {
	db             *gorm.DB
	inspectionRepo *repository.InspectionRepo
	deviceRepo     *repository.DeviceRepo
	workOrderRepo  *repository.WorkOrderRepo
	userRepo       *repository.UserRepo
}

func NewScheduleService(db *gorm.DB,
	inspectionRepo *repository.InspectionRepo,
	deviceRepo *repository.DeviceRepo,
	workOrderRepo *repository.WorkOrderRepo,
	userRepo *repository.UserRepo) *ScheduleService {
	return &ScheduleService{
		db:             db,
		inspectionRepo: inspectionRepo,
		deviceRepo:     deviceRepo,
		workOrderRepo:  workOrderRepo,
		userRepo:       userRepo,
	}
}

type CreatePlanRequest struct {
	Name        string    `json:"name" validate:"required,max=256"`
	AreaID      int64     `json:"area_id" validate:"required,gt=0"`
	AssigneeID  int64     `json:"assignee_id"`
	StartTime   time.Time `json:"start_time" validate:"required"`
	EndTime     time.Time `json:"end_time" validate:"required,gtfield=StartTime"`
	DeviceIDs   []int64   `json:"device_ids"`
	DeviceCount int       `json:"device_count"`
	Priority    string    `json:"priority" validate:"priority"`
	Remark      string    `json:"remark" validate:"max=1024"`
	UseSmart    bool      `json:"use_smart"`
	SmartDays   int       `json:"smart_days"`
	SmartCount  int       `json:"smart_count"`
}

func (s *ScheduleService) CreatePlan(ctx context.Context, creatorID int64, req *CreatePlanRequest) (*model.InspectionPlan, error) {
	if req.UseSmart {
		recommended, err := s.RecommendInspectionDevices(ctx, req.AreaID, req.SmartDays, req.SmartCount)
		if err != nil {
			pkg.Warn(ctx, "smart recommendation failed, using manual selection", zap.Error(err))
		} else {
			req.DeviceIDs = recommended
			pkg.Info(ctx, fmt.Sprintf("smart recommendation selected %d devices", len(recommended)))
		}
	}

	if req.DeviceCount == 0 {
		req.DeviceCount = len(req.DeviceIDs)
	}

	idStrs := make([]string, 0, len(req.DeviceIDs))
	for _, id := range req.DeviceIDs {
		idStrs = append(idStrs, strconv.FormatInt(id, 10))
	}

	plan := &model.InspectionPlan{
		PlanCode:    "IP" + uuid.New().String()[:15],
		Name:        req.Name,
		AreaID:      req.AreaID,
		CreatorID:   creatorID,
		AssigneeID:  req.AssigneeID,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		DeviceIDs:   strings.Join(idStrs, ","),
		DeviceCount: req.DeviceCount,
		Priority:    req.Priority,
		Status:      model.InspectionStatusPending,
		Remark:      req.Remark,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if plan.Priority == "" {
		plan.Priority = model.PriorityMedium
	}

	if err := s.inspectionRepo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}
	return plan, nil
}

func (s *ScheduleService) RecommendInspectionDevices(ctx context.Context, areaID int64, days int, count int) ([]int64, error) {
	if days <= 0 {
		days = 90
	}
	if count <= 0 {
		count = 50
	}

	devices, err := s.deviceRepo.ListByAreaID(ctx, areaID)
	if err != nil {
		return nil, err
	}
	if len(devices) == 0 {
		return []int64{}, nil
	}

	type scoredDevice struct {
		ID     int64
		Score  float64
		Reason string
	}

	var scored []scoredDevice
	for _, d := range devices {
		score := 0.0
		reasons := make([]string, 0)

		if d.HealthScore < 60 {
			score += 50
			reasons = append(reasons, fmt.Sprintf("健康评分低(%d)", d.HealthScore))
		} else if d.HealthScore < 80 {
			score += 25
			reasons = append(reasons, fmt.Sprintf("健康评分中(%d)", d.HealthScore))
		}

		faultRate, err := s.inspectionRepo.GetDeviceFaultRate(ctx, d.ID, days)
		if err == nil && faultRate > 0 {
			score += faultRate * 100
			if faultRate > 0.3 {
				reasons = append(reasons, fmt.Sprintf("故障率高(%.0f%%)", faultRate*100))
			}
		}

		runningDays := int(time.Since(d.InstallDate).Hours() / 24)
		if runningDays > 1095 {
			score += 30
			reasons = append(reasons, "运行>3年")
		} else if runningDays > 730 {
			score += 15
			reasons = append(reasons, "运行>2年")
		} else if runningDays > 365 {
			score += 8
			reasons = append(reasons, "运行>1年")
		}

		if d.Status == model.DeviceStatusFault {
			score += 40
			reasons = append(reasons, "当前故障状态")
		} else if d.Status == model.DeviceStatusOffline {
			score += 20
			reasons = append(reasons, "当前离线状态")
		}

		if d.DeviceType == model.DeviceTypeHPS {
			score += 10
			reasons = append(reasons, "高压钠灯")
		}

		avgScore, err := s.inspectionRepo.GetAverageScore(ctx, d.ID, days)
		if err == nil && avgScore > 0 && avgScore < 70 {
			score += (70 - avgScore) * 0.5
			reasons = append(reasons, fmt.Sprintf("历史巡检评分低(%.0f)", avgScore))
		}

		if score > 0 {
			scored = append(scored, scoredDevice{
				ID:     d.ID,
				Score:  score,
				Reason: strings.Join(reasons, ";"),
			})
		}
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	resultCount := count
	if resultCount > len(scored) {
		resultCount = len(scored)
	}

	ids := make([]int64, 0, resultCount)
	for i := 0; i < resultCount; i++ {
		ids = append(ids, scored[i].ID)
	}

	pkg.Info(ctx, fmt.Sprintf("recommended %d devices for inspection", len(ids)))
	return ids, nil
}

func (s *ScheduleService) UpdatePlanStatus(ctx context.Context, planID int64, status string, operatorID int64) error {
	plan, err := s.inspectionRepo.GetPlanByID(ctx, planID)
	if err != nil {
		return err
	}
	oldStatus := plan.Status
	plan.Status = status
	plan.UpdatedAt = time.Now()

	if status == model.InspectionStatusInProgress && oldStatus == model.InspectionStatusPending {
		if plan.AssigneeID == 0 && operatorID > 0 {
			plan.AssigneeID = operatorID
		}
	}

	return s.inspectionRepo.UpdatePlan(ctx, plan)
}

type SubmitInspectionRequest struct {
	PlanID     int64   `json:"plan_id" validate:"required,gt=0"`
	DeviceID   int64   `json:"device_id" validate:"required,gt=0"`
	InspectorID int64  `json:"inspector_id" validate:"required,gt=0"`
	Appearance int     `json:"appearance" validate:"gte=0,lte=100"`
	Function   int     `json:"function" validate:"gte=0,lte=100"`
	Brightness int     `json:"brightness" validate:"gte=0,lte=100"`
	Cable      int     `json:"cable" validate:"gte=0,lte=100"`
	HasFault   bool    `json:"has_fault"`
	FaultDesc  string  `json:"fault_desc" validate:"max=512"`
	Images     string  `json:"images" validate:"max=1024"`
	Remark     string  `json:"remark" validate:"max=1024"`
}

func (s *ScheduleService) SubmitInspectionResult(ctx context.Context, req *SubmitInspectionRequest) (*model.InspectionRecord, error) {
	score := (req.Appearance + req.Function + req.Brightness + req.Cable) / 4

	record := &model.InspectionRecord{
		PlanID:      req.PlanID,
		DeviceID:    req.DeviceID,
		InspectorID: req.InspectorID,
		InspectTime: time.Now(),
		Appearance:  req.Appearance,
		Function:    req.Function,
		Brightness:  req.Brightness,
		Cable:       req.Cable,
		Score:       score,
		HasFault:    req.HasFault,
		FaultDesc:   req.FaultDesc,
		Images:      req.Images,
		Remark:      req.Remark,
		CreatedAt:   time.Now(),
	}

	if err := s.inspectionRepo.CreateRecord(ctx, record); err != nil {
		return nil, err
	}

	if err := s.deviceRepo.UpdateHealthScore(ctx, req.DeviceID, score); err != nil {
		pkg.Warn(ctx, "failed to update device health score",
			zap.Int64("device_id", req.DeviceID),
			zap.Error(err))
	}

	if req.HasFault {
		go s.createFaultWorkOrder(ctx, req.DeviceID, req.FaultDesc, req.InspectorID)
	}

	return record, nil
}

func (s *ScheduleService) createFaultWorkOrder(ctx context.Context, deviceID int64, faultDesc string, creatorID int64) {
	device, err := s.deviceRepo.GetByID(ctx, deviceID)
	if err != nil {
		pkg.Error(ctx, "failed to get device for work order", zap.Error(err))
		return
	}

	assigneeID, _, err := s.workOrderRepo.GetLeastBusyOperator(ctx, device.AreaID, model.RoleOperator)
	if err != nil || assigneeID == 0 {
		assigneeID = creatorID
	}

	order := &model.WorkOrder{
		OrderCode:   "WO" + uuid.New().String()[:15],
		Title:       fmt.Sprintf("巡检发现故障 - %s", faultDesc),
		Description: fmt.Sprintf("巡检发现设备故障: %s", faultDesc),
		DeviceID:    deviceID,
		AreaID:      device.AreaID,
		Priority:    model.PriorityMedium,
		Status:      model.WorkOrderStatusCreated,
		CreatorID:   creatorID,
		AssigneeID:  assigneeID,
		DueTime:     time.Now().Add(24 * time.Hour),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.workOrderRepo.Create(ctx, order); err != nil {
		pkg.Error(ctx, "failed to create work order from inspection", zap.Error(err))
		return
	}

	log := &model.WorkOrderLog{
		WorkOrderID: order.ID,
		FromStatus:  "",
		ToStatus:    model.WorkOrderStatusCreated,
		OperatorID:  creatorID,
		Remark:      "巡检发现故障自动创建工单",
		CreatedAt:   time.Now(),
	}
	_ = s.workOrderRepo.AddLog(ctx, log)

	pkg.Info(ctx, "work order created from inspection",
		zap.Int64("device_id", deviceID),
		zap.Int64("work_order_id", order.ID))
}

type WorkOrderService struct {
	db            *gorm.DB
	workOrderRepo *repository.WorkOrderRepo
	deviceRepo    *repository.DeviceRepo
	faultRepo     *repository.FaultRepo
	userRepo      *repository.UserRepo
}

func NewWorkOrderService(db *gorm.DB,
	workOrderRepo *repository.WorkOrderRepo,
	deviceRepo *repository.DeviceRepo,
	faultRepo *repository.FaultRepo,
	userRepo *repository.UserRepo) *WorkOrderService {
	return &WorkOrderService{
		db:            db,
		workOrderRepo: workOrderRepo,
		deviceRepo:    deviceRepo,
		faultRepo:     faultRepo,
		userRepo:      userRepo,
	}
}

type CreateWorkOrderRequest struct {
	Title       string `json:"title" validate:"required,max=256"`
	Description string `json:"description" validate:"max=1024"`
	FaultID     int64  `json:"fault_id"`
	DeviceID    int64  `json:"device_id" validate:"required,gt=0"`
	Priority    string `json:"priority" validate:"priority"`
	AssigneeID  int64  `json:"assignee_id"`
}

func (s *WorkOrderService) CreateWorkOrder(ctx context.Context, creatorID int64, req *CreateWorkOrderRequest) (*model.WorkOrder, error) {
	device, err := s.deviceRepo.GetByID(ctx, req.DeviceID)
	if err != nil {
		return nil, fmt.Errorf("设备不存在: %w", err)
	}

	assigneeID := req.AssigneeID
	if assigneeID == 0 {
		id, _, err := s.workOrderRepo.GetLeastBusyOperator(ctx, device.AreaID, model.RoleOperator)
		if err == nil && id > 0 {
			assigneeID = id
		}
	}

	priority := req.Priority
	if priority == "" {
		priority = model.PriorityMedium
	}

	dueHours := 24
	switch priority {
	case model.PriorityHigh:
		dueHours = 4
	case model.PriorityLow:
		dueHours = 72
	}

	order := &model.WorkOrder{
		OrderCode:   "WO" + uuid.New().String()[:15],
		Title:       req.Title,
		Description: req.Description,
		FaultID:     req.FaultID,
		DeviceID:    req.DeviceID,
		AreaID:      device.AreaID,
		Priority:    priority,
		Status:      model.WorkOrderStatusCreated,
		CreatorID:   creatorID,
		AssigneeID:  assigneeID,
		DueTime:     time.Now().Add(time.Duration(dueHours) * time.Hour),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		woRepo := repository.NewWorkOrderRepo(tx)
		if err := woRepo.Create(ctx, order); err != nil {
			return err
		}
		log := &model.WorkOrderLog{
			WorkOrderID: order.ID,
			FromStatus:  "",
			ToStatus:    model.WorkOrderStatusCreated,
			OperatorID:  creatorID,
			Remark:      "手动创建工单",
			CreatedAt:   time.Now(),
		}
		return woRepo.AddLog(ctx, log)
	})
	if err != nil {
		return nil, err
	}
	return order, nil
}

func (s *WorkOrderService) TransitionStatus(ctx context.Context, orderID int64, targetStatus string, operatorID int64, remark string) (*model.WorkOrder, error) {
	validTransitions := map[string][]string{
		model.WorkOrderStatusCreated:    {model.WorkOrderStatusAccepted, model.WorkOrderStatusCompleted},
		model.WorkOrderStatusAccepted:   {model.WorkOrderStatusProcessing, model.WorkOrderStatusCompleted},
		model.WorkOrderStatusProcessing: {model.WorkOrderStatusReviewing, model.WorkOrderStatusCompleted},
		model.WorkOrderStatusReviewing:  {model.WorkOrderStatusCompleted, model.WorkOrderStatusProcessing},
	}

	order, err := s.workOrderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	valid := false
	allowed, ok := validTransitions[order.Status]
	if ok {
		for _, s := range allowed {
			if s == targetStatus {
				valid = true
				break
			}
		}
	}
	if !valid {
		return nil, fmt.Errorf("非法的状态流转: %s -> %s", order.Status, targetStatus)
	}

	fromStatus := order.Status
	now := time.Now()

	switch targetStatus {
	case model.WorkOrderStatusAccepted:
		order.AcceptTime = now
		order.AssigneeID = operatorID
		responseMinutes := int(now.Sub(order.CreatedAt).Minutes())
		order.ResponseTime = responseMinutes
	case model.WorkOrderStatusProcessing:
		order.StartTime = now
	case model.WorkOrderStatusReviewing:
		order.CompleteTime = now
		if !order.StartTime.IsZero() {
			handleMinutes := int(now.Sub(order.StartTime).Minutes())
			order.HandleTime = handleMinutes
		}
	case model.WorkOrderStatusCompleted:
		order.ReviewTime = now
		if order.ResponseTime == 0 && !order.AcceptTime.IsZero() {
			order.ResponseTime = int(order.AcceptTime.Sub(order.CreatedAt).Minutes())
		}
		if order.HandleTime == 0 && !order.StartTime.IsZero() {
			completeTime := order.CompleteTime
			if completeTime.IsZero() {
				completeTime = now
			}
			order.HandleTime = int(completeTime.Sub(order.StartTime).Minutes())
		}
	}

	order.Status = targetStatus
	order.UpdatedAt = now

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		woRepo := repository.NewWorkOrderRepo(tx)
		if err := woRepo.Update(ctx, order); err != nil {
			return err
		}
		log := &model.WorkOrderLog{
			WorkOrderID: orderID,
			FromStatus:  fromStatus,
			ToStatus:    targetStatus,
			OperatorID:  operatorID,
			Remark:      remark,
			CreatedAt:   now,
		}
		return woRepo.AddLog(ctx, log)
	})
	if err != nil {
		return nil, err
	}

	if targetStatus == model.WorkOrderStatusCompleted && order.FaultID > 0 {
		fault, err := s.faultRepo.GetByID(ctx, order.FaultID)
		if err == nil && fault.Status != model.AlertStatusHandled {
			fault.Status = model.AlertStatusHandled
			fault.RecoveredAt = now
			fault.UpdatedAt = now
			_ = s.faultRepo.Update(ctx, fault)
			_, _ = s.faultRepo.RecoverFaults(ctx, order.DeviceID)
		}
	}

	return order, nil
}

func (s *WorkOrderService) AssignOrder(ctx context.Context, orderID int64, assigneeID int64, operatorID int64) error {
	order, err := s.workOrderRepo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		woRepo := repository.NewWorkOrderRepo(tx)
		oldAssignee := order.AssigneeID
		order.AssigneeID = assigneeID
		order.UpdatedAt = time.Now()
		if err := woRepo.Update(ctx, order); err != nil {
			return err
		}
		log := &model.WorkOrderLog{
			WorkOrderID: orderID,
			FromStatus:  order.Status,
			ToStatus:    order.Status,
			OperatorID:  operatorID,
			Remark:      fmt.Sprintf("工单转派: %d -> %d", oldAssignee, assigneeID),
			CreatedAt:   time.Now(),
		}
		return woRepo.AddLog(ctx, log)
	})
	return err
}

package service

import (
	"fmt"
	"gas-network-system/internal/config"
	"gas-network-system/internal/model"
	"gas-network-system/internal/repository"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type SchedulerService struct {
	Repo   *repository.Repository
	logger *zap.Logger
	config *config.Config
	mu     sync.Mutex
}

func NewSchedulerService(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *SchedulerService {
	return &SchedulerService{
		Repo:   repo,
		logger: logger,
		config: cfg,
	}
}

type GeneratePlanRequest struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

type PlanGenerationResult struct {
	GeneratedTasks int    `json:"generated_tasks"`
	Message        string `json:"message"`
}

func (s *SchedulerService) GenerateDailyPlans() (PlanGenerationResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	today := time.Now()
	tomorrow := today.AddDate(0, 0, 1)

	level1Pipelines, err := s.Repo.Pipeline.GetPipelinesByLevel(model.PipelineLevel1)
	if err != nil {
		return PlanGenerationResult{}, err
	}

	level2Pipelines, err := s.Repo.Pipeline.GetPipelinesByLevel(model.PipelineLevel2)
	if err != nil {
		return PlanGenerationResult{}, err
	}

	level3Pipelines, err := s.Repo.Pipeline.GetPipelinesByLevel(model.PipelineLevel3)
	if err != nil {
		return PlanGenerationResult{}, err
	}

	var tasks []model.InspectionTask
	var skippedDup int

	lvl1IDs := extractPipelineIDs(level1Pipelines)
	existingLvl1, err := s.Repo.Inspector.GetExistingTaskPipelineIDs(lvl1IDs, today, 1)
	if err != nil {
		s.logger.Warn("查询重复任务失败", zap.Error(err))
	}
	existingLvl1Set := toUintSet(existingLvl1)
	for _, pipeline := range level1Pipelines {
		if existingLvl1Set[pipeline.ID] {
			skippedDup++
			continue
		}
		task := s.createTask(pipeline, today, 1)
		tasks = append(tasks, task)
	}

	if tomorrow.Weekday() == time.Monday {
		lvl2IDs := extractPipelineIDs(level2Pipelines)
		existingLvl2, err := s.Repo.Inspector.GetExistingTaskPipelineIDs(lvl2IDs, tomorrow, 2)
		if err != nil {
			s.logger.Warn("查询重复任务失败", zap.Error(err))
		}
		existingLvl2Set := toUintSet(existingLvl2)
		for _, pipeline := range level2Pipelines {
			if existingLvl2Set[pipeline.ID] {
				skippedDup++
				continue
			}
			task := s.createTask(pipeline, tomorrow, 7)
			tasks = append(tasks, task)
		}
	}

	if tomorrow.Day() == 1 {
		lvl3IDs := extractPipelineIDs(level3Pipelines)
		existingLvl3, err := s.Repo.Inspector.GetExistingTaskPipelineIDs(lvl3IDs, tomorrow, 3)
		if err != nil {
			s.logger.Warn("查询重复任务失败", zap.Error(err))
		}
		existingLvl3Set := toUintSet(existingLvl3)
		for _, pipeline := range level3Pipelines {
			if existingLvl3Set[pipeline.ID] {
				skippedDup++
				continue
			}
			task := s.createTask(pipeline, tomorrow, 30)
			tasks = append(tasks, task)
		}
	}

	if len(tasks) == 0 {
		return PlanGenerationResult{
			GeneratedTasks: 0,
			Message:        fmt.Sprintf("无新任务需要生成（跳过%d条重复任务）", skippedDup),
		}, nil
	}

	inspectors, err := s.Repo.Inspector.GetAvailableInspectors()
	if err != nil {
		return PlanGenerationResult{}, err
	}

	if len(inspectors) == 0 {
		return PlanGenerationResult{
			GeneratedTasks: 0,
			Message:        "没有可用的巡检员",
		}, nil
	}

	tasks = s.assignTasksByLoad(tasks, inspectors)

	if err := s.Repo.Inspector.BatchCreateTasks(tasks); err != nil {
		return PlanGenerationResult{}, err
	}

	s.logger.Info("巡检计划生成完成",
		zap.Int("total_tasks", len(tasks)),
		zap.Int("skipped_duplicates", skippedDup),
		zap.Int("level1_count", len(level1Pipelines)),
		zap.Time("date", today),
	)

	s.logOperation(0, "INSPECT", fmt.Sprintf("生成巡检计划%d条，跳过重复%d条", len(tasks), skippedDup))

	return PlanGenerationResult{
		GeneratedTasks: len(tasks),
		Message:        fmt.Sprintf("成功生成%d条巡检任务，跳过%d条重复任务", len(tasks), skippedDup),
	}, nil
}

func extractPipelineIDs(pipelines []model.Pipeline) []uint {
	ids := make([]uint, len(pipelines))
	for i, p := range pipelines {
		ids[i] = p.ID
	}
	return ids
}

func toUintSet(ids []uint) map[uint]bool {
	set := make(map[uint]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set
}

func (s *SchedulerService) createTask(pipeline model.Pipeline, date time.Time, intervalDays int) model.InspectionTask {
	taskNo := fmt.Sprintf("TASK-%s-%s", date.Format("20060102"), uuid.New().String()[:6])

	planStart := time.Date(date.Year(), date.Month(), date.Day(), 9, 0, 0, 0, date.Location())
	planEnd := planStart.Add(2 * time.Hour)

	return model.InspectionTask{
		TaskNo:     taskNo,
		PipelineID: pipeline.ID,
		Status:     model.TaskStatusPending,
		PlanDate:   date,
		PlanStart:  planStart,
		PlanEnd:    planEnd,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
}

func (s *SchedulerService) assignTasksByLoad(tasks []model.InspectionTask, inspectors []model.Inspector) []model.InspectionTask {
	type InspectorLoad struct {
		Inspector model.Inspector
		Load      int
	}

	var loads []InspectorLoad
	for _, insp := range inspectors {
		today := time.Now()
		startOfWeek := today.AddDate(0, 0, -int(today.Weekday()))
		endOfWeek := startOfWeek.AddDate(0, 0, 7)

		taskCount, _ := s.Repo.Inspector.GetTaskCountByInspector(insp.ID, startOfWeek, endOfWeek)
		loads = append(loads, InspectorLoad{
			Inspector: insp,
			Load:      int(taskCount),
		})
	}

	for i := range tasks {
		minLoad := math.MaxInt32
		var minInsp *InspectorLoad
		for j := range loads {
			if loads[j].Load < minLoad {
				minLoad = loads[j].Load
				minInsp = &loads[j]
			}
		}

		if minInsp != nil {
			tasks[i].InspectorID = &minInsp.Inspector.ID
			minInsp.Load++
		}
	}

	return tasks
}

type ReassignRequest struct {
	LeaveInspectorID uint      `json:"leave_inspector_id" binding:"required"`
	StartDate        time.Time `json:"start_date" binding:"required"`
	EndDate          time.Time `json:"end_date" binding:"required"`
}

type ReassignResult struct {
	ReassignedTasks int                 `json:"reassigned_tasks"`
	Assignments     []TaskAssignment `json:"assignments"`
}

type TaskAssignment struct {
	TaskID        uint   `json:"task_id"`
	OldInspector  uint   `json:"old_inspector"`
	NewInspector  uint   `json:"new_inspector"`
	NewName       string `json:"new_name"`
}

func (s *SchedulerService) ReassignInspectorTasks(req ReassignRequest) (ReassignResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tasks, err := s.Repo.Inspector.GetTasksForReassign(req.LeaveInspectorID, req.StartDate, req.EndDate)
	if err != nil {
		return ReassignResult{}, err
	}

	if len(tasks) == 0 {
		return ReassignResult{ReassignedTasks: 0}, nil
	}

	inspectors, err := s.Repo.Inspector.GetAvailableInspectors()
	if err != nil {
		return ReassignResult{}, err
	}

	var availableInspectors []model.Inspector
	for _, insp := range inspectors {
		if insp.ID != req.LeaveInspectorID {
			availableInspectors = append(availableInspectors, insp)
		}
	}

	if len(availableInspectors) == 0 {
		return ReassignResult{ReassignedTasks: 0}, fmt.Errorf("没有可用的巡检员进行任务重分配")
	}

	type InspectorInfo struct {
		Inspector model.Inspector
		TaskCount map[time.Time]int
	}

	var inspInfos []InspectorInfo
	for _, insp := range availableInspectors {
		tc := make(map[time.Time]int)
		inspInfos = append(inspInfos, InspectorInfo{
			Inspector: insp,
			TaskCount: tc,
		})
	}

	var assignments []TaskAssignment

	for _, task := range tasks {
		taskDate := time.Date(task.PlanDate.Year(), task.PlanDate.Month(), task.PlanDate.Day(), 0, 0, 0, 0, task.PlanDate.Location())

		minLoad := math.MaxInt32
		var selectedInsp *InspectorInfo

		for i := range inspInfos {
			if _, ok := inspInfos[i].TaskCount[taskDate]; !ok {
				dayTasks, _ := s.Repo.Inspector.GetTasksByInspectorAndDate(inspInfos[i].Inspector.ID, task.PlanDate)
				inspInfos[i].TaskCount[taskDate] = len(dayTasks)
			}

			if inspInfos[i].TaskCount[taskDate] < minLoad {
				minLoad = inspInfos[i].TaskCount[taskDate]
				selectedInsp = &inspInfos[i]
			}
		}

		if selectedInsp != nil {
			if err := s.Repo.Inspector.ReassignTask(task.ID, selectedInsp.Inspector.ID); err != nil {
				s.logger.Error("任务重分配失败", zap.Uint("task_id", task.ID), zap.Error(err))
				continue
			}

			selectedInsp.TaskCount[taskDate]++
			assignments = append(assignments, TaskAssignment{
				TaskID:       task.ID,
				OldInspector: req.LeaveInspectorID,
				NewInspector: selectedInsp.Inspector.ID,
				NewName:      selectedInsp.Inspector.Name,
			})
		}
	}

	s.logger.Info("巡检任务重分配完成",
		zap.Int("reassigned_count", len(assignments)),
		zap.Uint("leave_inspector", req.LeaveInspectorID),
	)

	s.logOperation(0, "INSPECT", fmt.Sprintf("巡检员%d请假，重分配%d条任务", req.LeaveInspectorID, len(assignments)))

	return ReassignResult{
		ReassignedTasks: len(assignments),
		Assignments:     assignments,
	}, nil
}

func (s *SchedulerService) CheckExpiredTasks() ([]model.InspectionTask, error) {
	expiryTime := time.Now().Add(-time.Duration(s.config.Inspect.AcceptTimeoutHours) * time.Hour)

	tasks, err := s.Repo.Inspector.GetPendingTasksBeforeTime(expiryTime)
	if err != nil {
		return nil, err
	}

	var expiredTasks []model.InspectionTask
	for _, task := range tasks {
		task.Status = model.TaskStatusExpired
		if err := s.Repo.Inspector.UpdateTask(&task); err != nil {
			s.logger.Error("更新任务状态失败", zap.Uint("task_id", task.ID), zap.Error(err))
			continue
		}
		expiredTasks = append(expiredTasks, task)
		s.logger.Warn("巡检任务超时未接单，已升级通知主管",
			zap.Uint("task_id", task.ID),
			zap.String("task_no", task.TaskNo),
		)
	}

	return expiredTasks, nil
}

func (s *SchedulerService) AcceptTask(taskID uint, inspectorID uint) error {
	task, err := s.Repo.Inspector.GetTaskByID(taskID)
	if err != nil {
		return err
	}

	if task.Status != model.TaskStatusPending {
		return fmt.Errorf("任务状态不允许接单")
	}

	now := time.Now()
	task.InspectorID = &inspectorID
	task.Status = model.TaskStatusAccepted
	task.AcceptedAt = &now
	task.ActualStart = &now

	if err := s.Repo.Inspector.UpdateTask(task); err != nil {
		return err
	}

	s.logOperation(taskID, "INSPECT", fmt.Sprintf("巡检员%d接单", inspectorID))

	return nil
}

func (s *SchedulerService) CompleteTask(taskID uint, remark string) error {
	task, err := s.Repo.Inspector.GetTaskByID(taskID)
	if err != nil {
		return err
	}

	if task.Status != model.TaskStatusInProgress && task.Status != model.TaskStatusAccepted {
		return fmt.Errorf("任务状态不允许完成")
	}

	now := time.Now()
	task.Status = model.TaskStatusCompleted
	task.ActualEnd = &now
	task.Remark = remark

	if err := s.Repo.Inspector.UpdateTask(task); err != nil {
		return err
	}

	s.logOperation(taskID, "INSPECT", "任务完成")

	return nil
}

func (s *SchedulerService) logOperation(resourceID uint, module string, operation string) {
	log := &model.OperationLog{
		UserID:     0,
		UserName:   "SYSTEM",
		Operation:  operation,
		Module:     module,
		ResourceID: resourceID,
		IPAddress:  "127.0.0.1",
		CreatedAt:  time.Now(),
	}
	_ = s.Repo.Log.Create(log)
}

type DispatchService struct {
	Repo   *repository.Repository
	logger *zap.Logger
	config *config.Config
	mu     sync.Mutex
}

func NewDispatchService(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *DispatchService {
	return &DispatchService{
		Repo:   repo,
		logger: logger,
		config: cfg,
	}
}

type DispatchRequest struct {
	AlarmID   uint   `json:"alarm_id" binding:"required"`
	Location  string `json:"location" binding:"required"`
}

type DispatchResult struct {
	OrderNo        string  `json:"order_no"`
	TeamID         uint    `json:"team_id"`
	TeamName       string  `json:"team_name"`
	LeaderName     string  `json:"leader_name"`
	Phone          string  `json:"phone"`
	Distance       float64 `json:"distance"`
	WorkloadScore  float64 `json:"workload_score"`
	DispatchReason string  `json:"dispatch_reason"`
}

type TeamScore struct {
	Team          model.RepairTeam
	Distance      float64
	WorkloadScore float64
	TotalScore    float64
}

func (s *DispatchService) DispatchAlarm(req DispatchRequest) (DispatchResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	alarm, err := s.Repo.Alarm.GetByID(req.AlarmID)
	if err != nil {
		return DispatchResult{}, fmt.Errorf("告警不存在: %w", err)
	}

	if alarm.Status != model.AlarmStatusNew {
		return DispatchResult{}, fmt.Errorf("告警已被调度")
	}

	teams, err := s.Repo.Repair.GetAllTeams()
	if err != nil {
		return DispatchResult{}, err
	}

	if len(teams) == 0 {
		return DispatchResult{}, fmt.Errorf("没有可用的抢修队")
	}

	alarmLocation := parseLocation(req.Location)

	var scores []TeamScore
	for _, team := range teams {
		teamLocation := parseLocation(team.Location)
		distance := calculateDistance(alarmLocation, teamLocation)

		activeTasks, _ := s.Repo.Repair.GetActiveOrderCountByTeam(team.ID)
		workloadScore := float64(activeTasks)

		normalizedDistance := distance / 50000.0
		if normalizedDistance > 1 {
			normalizedDistance = 1
		}
		normalizedWorkload := workloadScore / 5.0
		if normalizedWorkload > 1 {
			normalizedWorkload = 1
		}

		totalScore := s.config.Alarm.DistanceWeight*normalizedDistance +
			s.config.Alarm.WorkloadWeight*normalizedWorkload

		scores = append(scores, TeamScore{
			Team:          team,
			Distance:      distance,
			WorkloadScore: workloadScore,
			TotalScore:    totalScore,
		})
	}

	var bestScore *TeamScore
	minScore := math.MaxFloat64
	for i := range scores {
		if scores[i].TotalScore < minScore {
			minScore = scores[i].TotalScore
			bestScore = &scores[i]
		}
	}

	if bestScore == nil {
		return DispatchResult{}, fmt.Errorf("无法计算最优调度方案")
	}

	orderNo := fmt.Sprintf("ORD-%s", uuid.New().String()[:8])
	dispatchReason := fmt.Sprintf("调度决策依据：距离权重(%.1f)：%.2f公里，负荷权重(%.1f)：%.0f个在途任务，综合评分：%.4f",
		s.config.Alarm.DistanceWeight, bestScore.Distance/1000,
		s.config.Alarm.WorkloadWeight, bestScore.WorkloadScore,
		bestScore.TotalScore)

	order := &model.RepairOrder{
		OrderNo:        orderNo,
		AlarmID:        req.AlarmID,
		RepairTeamID:   bestScore.Team.ID,
		Status:         model.RepairStatusDispatched,
		DispatchReason: dispatchReason,
		Distance:       bestScore.Distance,
		WorkloadScore:  bestScore.WorkloadScore,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.Repo.Repair.CreateOrder(order); err != nil {
		return DispatchResult{}, err
	}

	if err := s.Repo.Alarm.UpdateStatus(req.AlarmID, model.AlarmStatusDispatched); err != nil {
		s.logger.Error("更新告警状态失败", zap.Error(err))
	}

	activeTasks, _ := s.Repo.Repair.GetActiveOrderCountByTeam(bestScore.Team.ID)
	newStatus := model.TeamStatusBusy
	if activeTasks > 0 {
		newStatus = model.TeamStatusBusy
	}
	if err := s.Repo.Repair.UpdateTeamStatus(bestScore.Team.ID, newStatus, int(activeTasks)); err != nil {
		s.logger.Error("更新抢修队状态失败", zap.Error(err))
	}

	s.logger.Info("抢修调度完成",
		zap.String("alarm_no", alarm.AlarmNo),
		zap.String("order_no", orderNo),
		zap.String("team", bestScore.Team.Name),
		zap.Float64("distance_km", bestScore.Distance/1000),
		zap.Float64("score", bestScore.TotalScore),
	)

	s.logOperation(req.AlarmID, "ALARM", fmt.Sprintf("调度至抢修队%s", bestScore.Team.Name))

	return DispatchResult{
		OrderNo:        orderNo,
		TeamID:         bestScore.Team.ID,
		TeamName:       bestScore.Team.Name,
		LeaderName:     bestScore.Team.LeaderName,
		Phone:          bestScore.Team.Phone,
		Distance:       bestScore.Distance,
		WorkloadScore:  bestScore.WorkloadScore,
		DispatchReason: dispatchReason,
	}, nil
}

type Location struct {
	Lat float64
	Lng float64
}

func parseLocation(location string) Location {
	parts := strings.Split(location, ",")
	if len(parts) != 2 {
		return Location{Lat: 0, Lng: 0}
	}
	lat, _ := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	lng, _ := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	return Location{Lat: lat, Lng: lng}
}

func calculateDistance(loc1, loc2 Location) float64 {
	const earthRadius = 6371000.0

	lat1 := loc1.Lat * math.Pi / 180
	lat2 := loc2.Lat * math.Pi / 180
	deltaLat := (loc2.Lat - loc1.Lat) * math.Pi / 180
	deltaLng := (loc2.Lng - loc1.Lng) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1)*math.Cos(lat2)*
			math.Sin(deltaLng/2)*math.Sin(deltaLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

func (s *DispatchService) UpdateRepairOrderStatus(orderID uint, status model.RepairOrderStatus, remark string) error {
	order, err := s.Repo.Repair.GetOrderByID(orderID)
	if err != nil {
		return err
	}

	if err := s.Repo.Repair.UpdateOrderStatus(orderID, status); err != nil {
		return err
	}

	if remark != "" {
		order.Remark = remark
		_ = s.Repo.Repair.SaveOrder(order)
	}

	if status == model.RepairStatusCompleted {
		_ = s.Repo.Alarm.UpdateStatus(order.AlarmID, model.AlarmStatusResolved)

		activeTasks, _ := s.Repo.Repair.GetActiveOrderCountByTeam(order.RepairTeamID)
		newStatus := model.TeamStatusIdle
		if activeTasks > 0 {
			newStatus = model.TeamStatusBusy
		}
		_ = s.Repo.Repair.UpdateTeamStatus(order.RepairTeamID, newStatus, int(activeTasks))
	}

	s.logOperation(orderID, "REPAIR", fmt.Sprintf("状态更新为%s", status))

	return nil
}

func (s *DispatchService) CheckOverdueAlarms() ([]model.Alarm, error) {
	timeoutSeconds := s.config.Alarm.DispatchTimeout
	alarms, err := s.Repo.Alarm.GetOverdueAlarms(timeoutSeconds)
	if err != nil {
		return nil, err
	}

	for _, alarm := range alarms {
		elapsed := time.Since(alarm.CreatedAt)
		s.logger.Warn("告警超时未调度，已升级通知主管",
			zap.Uint("alarm_id", alarm.ID),
			zap.String("alarm_no", alarm.AlarmNo),
			zap.String("level", string(alarm.Level)),
			zap.Float64("elapsed_seconds", elapsed.Seconds()),
			zap.Int("timeout_seconds", timeoutSeconds),
		)
		s.logOperation(alarm.ID, "ALARM",
			fmt.Sprintf("告警超时%.0f秒未调度，已升级通知主管", elapsed.Seconds()))
	}

	return alarms, nil
}

func (s *DispatchService) logOperation(resourceID uint, module string, operation string) {
	log := &model.OperationLog{
		UserID:     0,
		UserName:   "SYSTEM",
		Operation:  operation,
		Module:     module,
		ResourceID: resourceID,
		IPAddress:  "127.0.0.1",
		CreatedAt:  time.Now(),
	}
	_ = s.Repo.Log.Create(log)
}

type TrackService struct {
	Repo   *repository.Repository
	logger *zap.Logger
	config *config.Config
}

func NewTrackService(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *TrackService {
	return &TrackService{
		Repo:   repo,
		logger: logger,
		config: cfg,
	}
}

type TrackPoint struct {
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	Timestamp time.Time `json:"timestamp"`
}

type SubmitTrackRequest struct {
	TaskID      uint         `json:"task_id" binding:"required"`
	InspectorID uint        `json:"inspector_id" binding:"required"`
	TrackPoints []TrackPoint `json:"track_points" binding:"required,min=1"`
}

type TrackCheckResult struct {
	IsDeviated      bool        `json:"is_deviated"`
	MaxDeviation    float64     `json:"max_deviation"`
	AvgDeviation    float64     `json:"avg_deviation"`
	DeviationPoints []TrackPoint `json:"deviation_points,omitempty"`
}

func (s *TrackService) SubmitAndCheckTrack(req SubmitTrackRequest) (TrackCheckResult, error) {
	task, err := s.Repo.Inspector.GetTaskByID(req.TaskID)
	if err != nil {
		return TrackCheckResult{}, err
	}

	pipeline, err := s.Repo.Pipeline.GetByID(task.PipelineID)
	if err != nil {
		return TrackCheckResult{}, err
	}

	routePoints := parseRouteCoords(pipeline.RouteCoords)

	if len(routePoints) < 2 {
		routePoints = []Location{
			parseLocation(pipeline.StartPoint),
			parseLocation(pipeline.EndPoint),
		}
	}

	var maxDeviation float64
	var totalDeviation float64
	var deviationPoints []TrackPoint

	for _, tp := range req.TrackPoints {
		pointLoc := Location{Lat: tp.Lat, Lng: tp.Lng}
		minDist := math.MaxFloat64

		for i := 0; i < len(routePoints)-1; i++ {
			dist := distanceToSegment(pointLoc, routePoints[i], routePoints[i+1])
			if dist < minDist {
				minDist = dist
			}
		}

		totalDeviation += minDist
		if minDist > maxDeviation {
			maxDeviation = minDist
		}
		if minDist > s.config.Inspect.MaxDeviationMeters {
			deviationPoints = append(deviationPoints, tp)
		}
	}

	avgDeviation := 0.0
	if len(req.TrackPoints) > 0 {
		avgDeviation = totalDeviation / float64(len(req.TrackPoints))
	}

	isDeviated := maxDeviation > s.config.Inspect.MaxDeviationMeters

	deviationPointsJSON, _ := marshalTrackPoints(deviationPoints)
	trackPointsJSON, _ := marshalTrackPoints(req.TrackPoints)

	track := &model.InspectionTrack{
		TaskID:          req.TaskID,
		InspectorID:     req.InspectorID,
		TrackPoints:     trackPointsJSON,
		SubmitTime:      time.Now(),
		Deviation:       maxDeviation,
		IsDeviated:      isDeviated,
		DeviationPoints: deviationPointsJSON,
		CreatedAt:       time.Now(),
	}

	if err := s.Repo.Track.Create(track); err != nil {
		return TrackCheckResult{}, err
	}

	if isDeviated {
		s.logger.Warn("巡检轨迹偏航",
			zap.Uint("task_id", req.TaskID),
			zap.Uint("inspector_id", req.InspectorID),
			zap.Float64("max_deviation", maxDeviation),
			zap.Int("deviation_points", len(deviationPoints)),
		)
	}

	return TrackCheckResult{
		IsDeviated:      isDeviated,
		MaxDeviation:    maxDeviation,
		AvgDeviation:    avgDeviation,
		DeviationPoints: deviationPoints,
	}, nil
}

func parseRouteCoords(coords string) []Location {
	if coords == "" {
		return nil
	}

	var locations []Location
	pointStrs := strings.Split(coords, ";")
	for _, ps := range pointStrs {
		loc := parseLocation(ps)
		if loc.Lat != 0 || loc.Lng != 0 {
			locations = append(locations, loc)
		}
	}
	return locations
}

func distanceToSegment(p, a, b Location) float64 {
	ap := Location{p.Lat - a.Lat, p.Lng - a.Lng}
	ab := Location{b.Lat - a.Lat, b.Lng - a.Lng}

	dot := ap.Lat*ab.Lat + ap.Lng*ab.Lng
	lenSq := ab.Lat*ab.Lat + ab.Lng*ab.Lng

	var t float64
	if lenSq != 0 {
		t = dot / lenSq
	}

	var closest Location
	if t < 0 {
		closest = a
	} else if t > 1 {
		closest = b
	} else {
		closest = Location{a.Lat + t*ab.Lat, a.Lng + t*ab.Lng}
	}

	return calculateDistance(p, closest)
}

func marshalTrackPoints(points []TrackPoint) (string, error) {
	if len(points) == 0 {
		return "", nil
	}
	var parts []string
	for _, p := range points {
		parts = append(parts, fmt.Sprintf("%.6f,%.6f,%d", p.Lat, p.Lng, p.Timestamp.Unix()))
	}
	return strings.Join(parts, ";"), nil
}

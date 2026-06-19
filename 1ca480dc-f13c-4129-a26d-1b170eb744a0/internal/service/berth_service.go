package service

import (
	"fmt"
	"sort"
	"time"

	"port-ops-system/internal/model"
	"port-ops-system/internal/repository"
)

type BerthService struct {
	berthRepo     repository.BerthRepository
	craneRepo     repository.QuayCraneRepository
	vesselRepo    repository.VesselRepository
	vesselCallRepo repository.VesselCallRepository
	planRepo      repository.BerthPlanRepository
	assignmentRepo repository.CraneAssignmentRepository
}

func NewBerthService(
	berthRepo repository.BerthRepository,
	craneRepo repository.QuayCraneRepository,
	vesselRepo repository.VesselRepository,
	vesselCallRepo repository.VesselCallRepository,
	planRepo repository.BerthPlanRepository,
	assignmentRepo repository.CraneAssignmentRepository,
) *BerthService {
	return &BerthService{
		berthRepo:     berthRepo,
		craneRepo:     craneRepo,
		vesselRepo:    vesselRepo,
		vesselCallRepo: vesselCallRepo,
		planRepo:      planRepo,
		assignmentRepo: assignmentRepo,
	}
}

type ScheduleRequest struct {
	VesselCallID  int64
	IsEmergency   bool
	PreferredBerth *int64
}

func (s *BerthService) ListBerths() ([]*model.Berth, error) {
	return s.berthRepo.List()
}

func (s *BerthService) GetBerth(id int64) (*model.Berth, error) {
	return s.berthRepo.GetByID(id)
}

func (s *BerthService) ListCranes() ([]*model.QuayCrane, error) {
	return s.craneRepo.List()
}

func (s *BerthService) GetCrane(id int64) (*model.QuayCrane, error) {
	return s.craneRepo.GetByID(id)
}

func (s *BerthService) ListVesselCalls(page, pageSize int, filters map[string]interface{}) ([]*model.VesselCall, int64, error) {
	return s.vesselCallRepo.List(page, pageSize, filters)
}

func (s *BerthService) GetVesselCall(id int64) (*model.VesselCall, error) {
	return s.vesselCallRepo.GetByID(id)
}

func (s *BerthService) CreateVesselCall(vc *model.VesselCall) error {
	now := time.Now()
	vc.CreatedAt = now
	vc.UpdatedAt = now
	return s.vesselCallRepo.Create(vc)
}

func (s *BerthService) GenerateSchedule(req *ScheduleRequest) (*model.ScheduleRecommendation, error) {
	vesselCall, err := s.vesselCallRepo.GetByID(req.VesselCallID)
	if err != nil {
		return nil, fmt.Errorf("获取船舶靠港计划失败: %w", err)
	}
	if vesselCall == nil {
		return nil, fmt.Errorf("船舶靠港计划不存在")
	}

	berths, err := s.berthRepo.List()
	if err != nil {
		return nil, fmt.Errorf("获取泊位列表失败: %w", err)
	}

	var startBase time.Time
	if vesselCall.ETA != nil {
		startBase = *vesselCall.ETA
	} else {
		startBase = time.Now().Add(2 * time.Hour)
	}

	workingRatePerCrane := 30
	totalTEU := vesselCall.TotalTEU
	if totalTEU <= 0 {
		totalTEU = (vesselCall.ImportTEU + vesselCall.ExportTEU)
	}
	if totalTEU <= 0 {
		totalTEU = 500
	}

	type berthCandidate struct {
		berth    *model.Berth
		score    float64
		startTime time.Time
		endTime   time.Time
		duration  time.Duration
		craneIDs []int64
	}

	candidates := make([]*berthCandidate, 0)
	for _, berth := range berths {
		if berth.Status == model.BerthStatusMaintenance {
			continue
		}

		if req.PreferredBerth != nil && *req.PreferredBerth != berth.ID {
			continue
		}

		availableStart, conflicts, err := s.findAvailableWindow(berth.ID, startBase, 48*time.Hour)
		if err != nil {
			continue
		}

		optimalCraneCount := s.calculateOptimalCraneCount(totalTEU)
		availableCranes, err := s.findAvailableCranes(berth.ID, availableStart, totalTEU, optimalCraneCount)
		if err != nil || len(availableCranes) == 0 {
			continue
		}

		cranesNeeded := optimalCraneCount
		if len(availableCranes) < cranesNeeded {
			cranesNeeded = len(availableCranes)
		}
		if cranesNeeded == 0 {
			cranesNeeded = 1
		}

		effectiveRate := float64(cranesNeeded * workingRatePerCrane)
		hoursNeeded := float64(totalTEU) / effectiveRate
		if hoursNeeded < 2 {
			hoursNeeded = 2
		}
		duration := time.Duration(hoursNeeded * float64(time.Hour))
		endTime := availableStart.Add(duration)

		score := s.scoreBerthAssignment(berth, availableStart, endTime, conflicts, cranesNeeded, req.IsEmergency)

		craneIDs := make([]int64, 0, cranesNeeded)
		for i := 0; i < cranesNeeded; i++ {
			craneIDs = append(craneIDs, availableCranes[i].ID)
		}

		candidates = append(candidates, &berthCandidate{
			berth:     berth,
			score:     score,
			startTime: availableStart,
			endTime:   endTime,
			duration:  duration,
			craneIDs:  craneIDs,
		})
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("无可用泊位")
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	best := candidates[0]

	craneCodes := make([]string, 0, len(best.craneIDs))
	for _, cid := range best.craneIDs {
		if c, err := s.craneRepo.GetByID(cid); err == nil && c != nil {
			craneCodes = append(craneCodes, c.CraneCode)
		}
	}

	durationStr := fmt.Sprintf("%.1f小时", best.duration.Hours())

	notes := make([]string, 0)
	if req.IsEmergency {
		notes = append(notes, "紧急靠泊优先处理")
	}

	return &model.ScheduleRecommendation{
		PlanID:           0,
		BerthCode:        best.berth.BerthCode,
		VesselName:       vesselCall.VesselName,
		RecommendedStart: &best.startTime,
		RecommendedEnd:   &best.endTime,
		AssignedCranes:   craneCodes,
		EstimatedDuration: durationStr,
		OptimizationScore: best.score,
		Notes:            notes,
	}, nil
}

func (s *BerthService) findAvailableWindow(berthID int64, preferredStart time.Time, horizon time.Duration) (time.Time, int, error) {
	searchEnd := preferredStart.Add(horizon)
	existingPlans, err := s.planRepo.ListByBerthAndRange(berthID, preferredStart, searchEnd)
	if err != nil {
		return preferredStart, 0, err
	}

	if len(existingPlans) == 0 {
		return preferredStart, 0, nil
	}

	type timeSlot struct {
		start, end time.Time
	}
	slots := make([]timeSlot, 0, len(existingPlans))
	for _, p := range existingPlans {
		if p.StartTime != nil && p.EndTime != nil {
			slots = append(slots, timeSlot{*p.StartTime, *p.EndTime})
		}
	}

	sort.Slice(slots, func(i, j int) bool {
		return slots[i].start.Before(slots[j].start)
	})

	candidateStart := preferredStart
	conflicts := 0
	for _, slot := range slots {
		if candidateStart.Before(slot.end) && candidateStart.Add(time.Hour).After(slot.start) {
			candidateStart = slot.end
			conflicts++
		}
	}

	if candidateStart.After(searchEnd) {
		return slots[len(slots)-1].end, conflicts, nil
	}

	return candidateStart, conflicts, nil
}

func (s *BerthService) calculateOptimalCraneCount(totalTEU int) int {
	switch {
	case totalTEU >= 2000:
		return 4
	case totalTEU >= 1000:
		return 3
	case totalTEU >= 500:
		return 2
	default:
		return 1
	}
}

func (s *BerthService) findAvailableCranes(berthID int64, startTime time.Time, totalTEU int, needed int) ([]*model.QuayCrane, error) {
	allCranes, err := s.craneRepo.ListByBerth(berthID)
	if err != nil {
		return nil, err
	}

	available := make([]*model.QuayCrane, 0)
	endTime := startTime.Add(48 * time.Hour)
	for _, crane := range allCranes {
		if crane.Status == model.QuayCraneStatusMaintenance {
			continue
		}

		assignments, err := s.assignmentRepo.ListByCraneAndRange(crane.ID, startTime, endTime)
		if err != nil {
			continue
		}

		if len(assignments) == 0 {
			available = append(available, crane)
		}
	}

	return available, nil
}

func (s *BerthService) scoreBerthAssignment(
	berth *model.Berth,
	startTime, endTime time.Time,
	conflicts int,
	craneCount int,
	isEmergency bool,
) float64 {
	score := 100.0

	if conflicts > 0 {
		score -= float64(conflicts) * 20
	}

	if startTime.Sub(time.Now()) < 4*time.Hour {
		score += 15
	} else if startTime.Sub(time.Now()) < 12*time.Hour {
		score += 10
	} else if startTime.Sub(time.Now()) > 24*time.Hour {
		score -= 10
	}

	duration := endTime.Sub(startTime)
	hours := duration.Hours()
	if hours < 12 {
		score += 10
	} else if hours > 36 {
		score -= 15
	}

	switch berth.Status {
	case model.BerthStatusIdle:
		score += 20
	case model.BerthStatusReserved:
		score -= 10
	case model.BerthStatusOccupied:
		score -= 30
	}

	score += float64(craneCount) * 5

	if isEmergency {
		score += 50
	}

	return score
}

func (s *BerthService) ConfirmPlan(plan *model.BerthPlan) (*model.BerthPlan, error) {
	now := time.Now()
	plan.CreatedAt = now
	plan.UpdatedAt = now
	if plan.Status == "" {
		plan.Status = "CONFIRMED"
	}

	if err := s.planRepo.Create(plan); err != nil {
		return nil, fmt.Errorf("创建泊位计划失败: %w", err)
	}

	return plan, nil
}

func (s *BerthService) ListPlansByDate(date time.Time) ([]*model.BerthPlan, error) {
	return s.planRepo.ListByDate(date)
}

func (s *BerthService) AdjustPlan(id int64, startTime, endTime *time.Time) error {
	plan, err := s.planRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("获取泊位计划失败: %w", err)
	}
	if plan == nil {
		return fmt.Errorf("泊位计划不存在")
	}

	if startTime != nil {
		plan.StartTime = startTime
	}
	if endTime != nil {
		plan.EndTime = endTime
	}
	plan.UpdatedAt = time.Now()

	return s.planRepo.Update(plan)
}

func (s *BerthService) DeletePlan(id int64) error {
	return s.planRepo.Delete(id)
}

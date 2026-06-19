package service

import (
	"fmt"
	"sort"
	"time"

	"port-ops-system/internal/model"
	"port-ops-system/internal/repository"
)

type ContainerService struct {
	containerRepo repository.ContainerRepository
	yardRepo      repository.YardRepository
	slotRepo      repository.YardSlotRepository
}

func NewContainerService(
	containerRepo repository.ContainerRepository,
	yardRepo repository.YardRepository,
	slotRepo repository.YardSlotRepository,
) *ContainerService {
	return &ContainerService{
		containerRepo: containerRepo,
		yardRepo:      yardRepo,
		slotRepo:      slotRepo,
	}
}

type SlotAllocationRequest struct {
	ContainerID   int64
	ContainerNo   string
	ContainerType model.ContainerType
	Size          model.ContainerSize
	WeightLevel   model.WeightLevel
	Destination   string
	ShippingLine  string
	EstimatedOut  *time.Time
}

func (s *ContainerService) CreateContainer(c *model.Container) error {
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now
	c.Status = model.ContainerStatusInYard
	if c.InTime == nil {
		c.InTime = &now
	}
	return s.containerRepo.Create(c)
}

func (s *ContainerService) GetContainer(id int64) (*model.Container, error) {
	return s.containerRepo.GetByID(id)
}

func (s *ContainerService) GetContainerByNo(no string) (*model.Container, error) {
	return s.containerRepo.GetByNo(no)
}

func (s *ContainerService) ListContainers(page, pageSize int, filters map[string]interface{}) ([]*model.Container, int64, error) {
	return s.containerRepo.List(page, pageSize, filters)
}

func (s *ContainerService) UpdateContainer(c *model.Container) error {
	c.UpdatedAt = time.Now()
	return s.containerRepo.Update(c)
}

func (s *ContainerService) RecommendSlot(req *SlotAllocationRequest) (*model.SlotRecommendation, error) {
	yards, err := s.yardRepo.ListByType(req.ContainerType)
	if err != nil {
		return nil, fmt.Errorf("获取堆场列表失败: %w", err)
	}
	if len(yards) == 0 {
		yards, err = s.yardRepo.List()
		if err != nil {
			return nil, fmt.Errorf("获取堆场列表失败: %w", err)
		}
	}

	yardIDs := make([]int64, 0, len(yards))
	for _, y := range yards {
		yardIDs = append(yardIDs, y.ID)
	}

	availableSlots, err := s.slotRepo.ListAvailable(yardIDs, req.ContainerType, req.Size)
	if err != nil {
		return nil, fmt.Errorf("获取可用堆位失败: %w", err)
	}

	candidates := make([]*model.SlotOption, 0, len(availableSlots))
	for _, slot := range availableSlots {
		option := s.scoreSlot(slot, req, yards)
		candidates = append(candidates, option)
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Score > candidates[j].Score
	})

	topN := 5
	if len(candidates) < topN {
		topN = len(candidates)
	}

	avgScore := 0.0
	slotOptions := make([]model.SlotOption, 0, topN)
	if topN > 0 {
		sum := 0.0
		for i := 0; i < topN; i++ {
			sum += candidates[i].Score
			slotOptions = append(slotOptions, *candidates[i])
		}
		avgScore = sum / float64(topN)
	}

	return &model.SlotRecommendation{
		ContainerID: req.ContainerID,
		ContainerNo: req.ContainerNo,
		Slots:       slotOptions,
		Algorithm:   "BAYESIAN_SLOT_SCORING_V1",
		Score:       avgScore,
	}, nil
}

func (s *ContainerService) scoreSlot(slot *model.YardSlot, req *SlotAllocationRequest, yards []*model.Yard) *model.SlotOption {
	score := 0.0
	reasons := make([]string, 0)

	var targetYard *model.Yard
	for _, y := range yards {
		if y.ID == slot.YardID {
			targetYard = y
			break
		}
	}

	if targetYard != nil {
		if targetYard.ContainerType == req.ContainerType {
			score += 30
			reasons = append(reasons, "箱型匹配专用堆场")
		} else if targetYard.ContainerType == "" {
			score += 15
			reasons = append(reasons, "通用堆场可用")
		} else {
			score -= 20
		}
	}

	if slot.TierNo <= 2 {
		score += 25
		reasons = append(reasons, "低层位翻箱率低")
	} else if slot.TierNo <= 4 {
		score += 10
	} else {
		score -= 10
		reasons = append(reasons, "高层位翻箱风险高")
	}

	if req.WeightLevel == model.WeightLevelHeavy {
		if slot.TierNo <= 2 {
			score += 15
			reasons = append(reasons, "重箱低放稳堆")
		} else {
			score -= 15
		}
	} else if req.WeightLevel == model.WeightLevelLight {
		if slot.TierNo >= 3 {
			score += 10
			reasons = append(reasons, "轻箱高放合理")
		}
	}

	estimatedReshuffles := slot.TierNo
	score -= float64(estimatedReshuffles) * 3

	if targetYard != nil {
		occupancy := 0.0
		if targetYard.Capacity > 0 {
			occupancy = float64(targetYard.UsedCount) / float64(targetYard.Capacity)
		}
		if occupancy < 0.5 {
			score += 10
			reasons = append(reasons, "堆场利用率适中")
		} else if occupancy > 0.85 {
			score -= 5
		}
	}

	score += 10

	reasonStr := ""
	for i, r := range reasons {
		if i > 0 {
			reasonStr += "; "
		}
		reasonStr += r
	}

	riskFactor := 0.0
	if slot.TierNo > 3 {
		riskFactor += 0.3
	}
	if estimatedReshuffles > 3 {
		riskFactor += 0.2
	}
	if riskFactor > 1.0 {
		riskFactor = 1.0
	}

	return &model.SlotOption{
		SlotCode:            slot.SlotCode,
		YardCode:            slot.YardCode,
		BayNo:               slot.BayNo,
		RowNo:               slot.RowNo,
		TierNo:              slot.TierNo,
		Score:               score,
		RiskFactor:          riskFactor,
		EstimatedReshuffles: estimatedReshuffles,
		Reason:              reasonStr,
	}
}

func (s *ContainerService) AssignSlot(containerID int64, slotCode string) error {
	slot, err := s.slotRepo.GetByCode(slotCode)
	if err != nil {
		return fmt.Errorf("获取堆位失败: %w", err)
	}
	if slot == nil {
		return fmt.Errorf("堆位不存在: %s", slotCode)
	}
	if slot.IsOccupied {
		return fmt.Errorf("堆位已被占用: %s", slotCode)
	}

	container, err := s.containerRepo.GetByID(containerID)
	if err != nil {
		return fmt.Errorf("获取集装箱失败: %w", err)
	}
	if container == nil {
		return fmt.Errorf("集装箱不存在: %d", containerID)
	}

	if err := s.containerRepo.AssignSlot(containerID, slot.YardID, slot.BayNo, slot.RowNo, slot.TierNo, slotCode); err != nil {
		return fmt.Errorf("分配堆位失败: %w", err)
	}

	if err := s.slotRepo.Occupy(slotCode, containerID, container.ContainerNo); err != nil {
		return fmt.Errorf("标记堆位占用失败: %w", err)
	}

	return nil
}

func (s *ContainerService) CalculateReshufflePlan(containerID int64) ([]*model.ReshufflePlan, error) {
	container, err := s.containerRepo.GetByID(containerID)
	if err != nil {
		return nil, fmt.Errorf("获取集装箱失败: %w", err)
	}
	if container == nil {
		return nil, fmt.Errorf("集装箱不存在")
	}

	slots, err := s.slotRepo.ListByBay(container.YardID, container.BayNo)
	if err != nil {
		return nil, fmt.Errorf("获取贝位堆位失败: %w", err)
	}

	plans := make([]*model.ReshufflePlan, 0)
	for _, slot := range slots {
		if slot.IsOccupied && slot.RowNo == container.RowNo && slot.TierNo > container.TierNo {
			plans = append(plans, &model.ReshufflePlan{
				SourceSlot:  slot.SlotCode,
				TargetSlot:  "",
				ContainerNo: slot.ContainerNo,
				Priority:    slot.TierNo,
			})
		}
	}

	sort.Slice(plans, func(i, j int) bool {
		return plans[i].Priority > plans[j].Priority
	})

	return plans, nil
}

func (s *ContainerService) ListYards() ([]*model.Yard, error) {
	return s.yardRepo.List()
}

func (s *ContainerService) GetYard(id int64) (*model.Yard, error) {
	return s.yardRepo.GetByID(id)
}

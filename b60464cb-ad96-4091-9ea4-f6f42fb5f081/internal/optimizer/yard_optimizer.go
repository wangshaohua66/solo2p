package optimizer

import (
	"fmt"
	"math"
	"sort"

	"terminal-dispatcher/internal/config"
	"terminal-dispatcher/internal/db"
)

type YardOptimizer struct {
	cfg *config.YardConfig
}

type SlotScore struct {
	Slot  db.YardSlot
	Score float64
	Reasons []string
}

func NewYardOptimizer(cfg *config.YardConfig) *YardOptimizer {
	return &YardOptimizer{cfg: cfg}
}

func (y *YardOptimizer) FindOptimalSlot(container *db.Container, slots []db.YardSlot) (*SlotScore, error) {
	if len(slots) == 0 {
		return nil, fmt.Errorf("no available slots")
	}

	var candidates []SlotScore

	for _, slot := range slots {
		if slot.Occupied {
			continue
		}
		score, reasons := y.calculateScore(container, slot, slots)
		candidates = append(candidates, SlotScore{
			Slot:    slot,
			Score:   score,
			Reasons: reasons,
		})
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no available slots")
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Score > candidates[j].Score
	})

	return &candidates[0], nil
}

func (y *YardOptimizer) calculateScore(c *db.Container, slot db.YardSlot, allSlots []db.YardSlot) (float64, []string) {
	score := 100.0
	var reasons []string

	if c.IsReefer {
		if slot.HasPower {
			score += 30
			reasons = append(reasons, "冷藏箱匹配电源位")
		} else {
			score -= 100
			reasons = append(reasons, "冷藏箱无电源-否决")
		}
	} else {
		if !slot.HasPower {
			score += 10
			reasons = append(reasons, "电源位留给冷藏箱")
		}
	}

	if c.IsHazardous {
		if y.isHazardSafe(slot, allSlots, c.HazardClass) {
			score += 20
			reasons = append(reasons, "危险品安全间距达标")
		} else {
			score -= 80
			reasons = append(reasons, "危险品间距不足")
		}
	}

	weightScore := y.weightDistributionScore(c, slot, allSlots)
	score += weightScore
	if weightScore > 0 {
		reasons = append(reasons, "重箱低层摆放合理")
	} else if weightScore < -10 {
		reasons = append(reasons, "存在重压轻风险")
	}

	destScore := y.destinationGroupScore(c, slot, allSlots)
	score += destScore
	if destScore > 5 {
		reasons = append(reasons, "同目的港集中堆放")
	}

	heightPenalty := float64(slot.Tier) * 2
	score -= heightPenalty
	if slot.Tier > 3 {
		reasons = append(reasons, "高层位翻箱风险")
	}

	return score, reasons
}

func (y *YardOptimizer) weightDistributionScore(c *db.Container, slot db.YardSlot, allSlots []db.YardSlot) float64 {
	score := 0.0

	for _, s := range allSlots {
		if !s.Occupied || s.Bay != slot.Bay || s.Row != slot.Row {
			continue
		}
		if s.Tier >= slot.Tier {
			continue
		}

		lowerWeight := y.getSlotWeight(s, allSlots)
		if lowerWeight > 0 && c.Weight > lowerWeight+y.cfg.MinWeightGap {
			score -= 15
		}
		if c.Weight < lowerWeight {
			score += 10
		}
	}

	if c.Weight > 20 && slot.Tier <= 1 {
		score += 15
	}
	if c.Weight < 10 && slot.Tier >= 3 {
		score += 5
	}
	if c.Weight > 20 && slot.Tier >= 3 {
		score -= 20
	}

	return score
}

func (y *YardOptimizer) getSlotWeight(slot db.YardSlot, allSlots []db.YardSlot) float64 {
	for _, s := range allSlots {
		if s.ID == slot.ID && s.ContainerID != nil {
			return 15.0
		}
	}
	return 0
}

func (y *YardOptimizer) destinationGroupScore(c *db.Container, slot db.YardSlot, allSlots []db.YardSlot) float64 {
	score := 0.0
	sameDest := 0

	for _, s := range allSlots {
		if !s.Occupied {
			continue
		}
		if s.Bay == slot.Bay && math.Abs(float64(s.Row-slot.Row)) <= 2 {
			sameDest++
		}
	}

	score += float64(sameDest) * 2.0
	return score
}

func (y *YardOptimizer) isHazardSafe(slot db.YardSlot, allSlots []db.YardSlot, hazardClass string) bool {
	for _, s := range allSlots {
		if !s.Occupied {
			continue
		}
		dist := math.Abs(float64(s.Bay-slot.Bay)) + math.Abs(float64(s.Row-slot.Row))
		if dist < 3 {
			return false
		}
	}
	return true
}

func (y *YardOptimizer) FindRestackWarnings(containers []db.Container) ([]db.RestackWarning, error) {
	var warnings []db.RestackWarning

	stackMap := make(map[string][]db.Container)
	for _, c := range containers {
		if c.Status != "stored" {
			continue
		}
		key := fmt.Sprintf("%d-%d", c.Bay, c.Row)
		stackMap[key] = append(stackMap[key], c)
	}

	for _, stack := range stackMap {
		sort.Slice(stack, func(i, j int) bool {
			return stack[i].Tier < stack[j].Tier
		})

		for i, lower := range stack {
			blockedCount := 0
			var blockers []string

			for j := i + 1; j < len(stack); j++ {
				upper := stack[j]
				if y.needsRestack(&lower, &upper) {
					blockedCount++
					blockers = append(blockers, upper.ContainerNo)
				}
			}

			if blockedCount > 0 {
				warnings = append(warnings, db.RestackWarning{
					ContainerID:    lower.ID,
					ContainerNo:    lower.ContainerNo,
					BlockedByCount: blockedCount,
					Blockers:       blockers,
					MinRestacks:    blockedCount,
				})
			}
		}
	}

	sort.Slice(warnings, func(i, j int) bool {
		return warnings[i].MinRestacks > warnings[j].MinRestacks
	})

	return warnings, nil
}

func (y *YardOptimizer) needsRestack(lower, upper *db.Container) bool {
	if lower.CustomsRelease && !upper.CustomsRelease {
		return true
	}

	if lower.Weight < upper.Weight-y.cfg.MinWeightGap {
		return true
	}

	return false
}

func (y *YardOptimizer) OptimizePlacementBatch(containers []db.Container, slots []db.YardSlot) (map[int]db.YardSlot, error) {
	result := make(map[int]db.YardSlot)
	usedSlots := make(map[int]bool)

	sorted := make([]db.Container, len(containers))
	copy(sorted, containers)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Weight > sorted[j].Weight
	})

	for _, c := range sorted {
		var available []db.YardSlot
		for _, s := range slots {
			if !usedSlots[s.ID] && !s.Occupied {
				available = append(available, s)
			}
		}

		best, err := y.FindOptimalSlot(&c, available)
		if err != nil {
			continue
		}
		result[c.ID] = best.Slot
		usedSlots[best.Slot.ID] = true
	}

	return result, nil
}

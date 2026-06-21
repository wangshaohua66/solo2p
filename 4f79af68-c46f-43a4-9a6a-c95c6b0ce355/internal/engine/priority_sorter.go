package engine

import (
	"fmt"
	"math"
	"sort"

	pverrors "pavement/internal/errors"
	"pavement/internal/storage"
	"pavement/internal/validator"
)

type PrioritySorter struct {
	GradeWeight      float64
	TrafficWeight    float64
	ImportanceWeight float64
	CostWeight       float64
}

type PriorityResult struct {
	Rank          int
	Record        *storage.PavementRecord
	PriorityScore float64
	EstimatedCost float64
}

type BudgetPlan struct {
	TotalBudget      float64
	AllocatedBudget  float64
	RemainingBudget  float64
	FundedCount      int
	PartiallyFunded  int
	UnfundedCount    int
	Allocations      []*storage.BudgetAllocation
}

const (
	DefaultGradeWeight      = 0.50
	DefaultTrafficWeight    = 0.25
	DefaultImportanceWeight = 0.15
	DefaultCostWeight       = 0.10
)

var maintenanceUnitCost = map[string]map[string]float64{
	"IRI": {
		"微表处":   55.0,
		"薄层罩面":  120.0,
		"铣刨重铺":  280.0,
	},
	"RUT": {
		"车辙填充":  180.0,
		"结构补强":  320.0,
	},
	"CRACK": {
		"裂缝灌封":  35.0,
		"局部修补":  90.0,
		"铣刨重铺":  280.0,
	},
}

func NewPrioritySorter() *PrioritySorter {
	return &PrioritySorter{
		GradeWeight:      DefaultGradeWeight,
		TrafficWeight:    DefaultTrafficWeight,
		ImportanceWeight: DefaultImportanceWeight,
		CostWeight:       DefaultCostWeight,
	}
}

func (ps *PrioritySorter) SetWeights(gradeW, trafficW, importanceW, costW float64) error {
	total := gradeW + trafficW + importanceW + costW
	if math.Abs(total-1.0) > 0.001 {
		return pverrors.NewPriorityError(
			pverrors.ErrPriorityInvalidWeight,
			fmt.Sprintf("权重之和不等于1: %.4f", total),
			"请确保病害等级、交通流量、重要性、成本效益四项权重之和为1.0",
			nil,
		)
	}
	if gradeW < 0 || trafficW < 0 || importanceW < 0 || costW < 0 {
		return pverrors.NewPriorityError(
			pverrors.ErrPriorityInvalidWeight,
			"权重不能为负数",
			"请确保所有权重参数为非负数",
			nil,
		)
	}
	ps.GradeWeight = gradeW
	ps.TrafficWeight = trafficW
	ps.ImportanceWeight = importanceW
	ps.CostWeight = costW
	return nil
}

func (ps *PrioritySorter) CalculatePriority(record *storage.PavementRecord) (float64, error) {
	if record == nil {
		return 0, pverrors.NewPriorityError(
			pverrors.ErrPriorityNoData,
			"待排序记录为空",
			"请确保传入有效的路面检测记录",
			nil,
		)
	}

	gradeScore := ps.calculateGradeScore(record.DiseaseGrade, record.TotalScore)
	trafficScore := ps.calculateTrafficScore(record.TrafficVolume)
	importanceScore := ps.calculateImportanceScore(record.Importance)
	costScore := ps.calculateCostEffectiveness(record)

	priority := gradeScore*ps.GradeWeight +
		trafficScore*ps.TrafficWeight +
		importanceScore*ps.ImportanceWeight +
		costScore*ps.CostWeight

	priority = math.Round(priority*100) / 100

	record.PriorityScore = priority
	estimatedCost := ps.EstimateMaintenanceCost(record)
	record.EstimatedCost = estimatedCost

	return priority, nil
}

func (ps *PrioritySorter) BatchCalculate(records []*storage.PavementRecord) (int, int) {
	success := 0
	failed := 0
	for _, record := range records {
		_, err := ps.CalculatePriority(record)
		if err != nil {
			failed++
		} else {
			success++
		}
	}
	return success, failed
}

func (ps *PrioritySorter) SortByPriority(records []*storage.PavementRecord, topN int) []*PriorityResult {
	results := make([]*PriorityResult, 0, len(records))
	for _, r := range records {
		results = append(results, &PriorityResult{
			Record:        r,
			PriorityScore: r.PriorityScore,
			EstimatedCost: r.EstimatedCost,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].PriorityScore > results[j].PriorityScore
	})

	for i, r := range results {
		r.Rank = i + 1
	}

	if topN > 0 && topN < len(results) {
		return results[:topN]
	}
	return results
}

func (ps *PrioritySorter) calculateGradeScore(grade string, totalScore float64) float64 {
	if totalScore > 0 {
		return 100.0 - totalScore
	}
	switch grade {
	case "优":
		return 15.0
	case "良":
		return 35.0
	case "中":
		return 65.0
	case "差":
		return 95.0
	default:
		return 50.0
	}
}

func (ps *PrioritySorter) calculateTrafficScore(volume float64) float64 {
	if volume <= 0 {
		return 30.0
	}
	score := (volume / 50000.0) * 100.0
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	return score
}

func (ps *PrioritySorter) calculateImportanceScore(importance float64) float64 {
	score := (importance / 3.0) * 100.0
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	return score
}

func (ps *PrioritySorter) calculateCostEffectiveness(record *storage.PavementRecord) float64 {
	if record.SectionLength <= 0 {
		return 50.0
	}
	severity := ps.calculateGradeScore(record.DiseaseGrade, record.TotalScore)
	cost := ps.EstimateMaintenanceCost(record)
	if cost <= 0 {
		return 50.0
	}
	ratio := (severity * record.SectionLength) / cost * 1000
	score := math.Log(ratio+1) * 20
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	return score
}

func (ps *PrioritySorter) EstimateMaintenanceCost(record *storage.PavementRecord) float64 {
	if record == nil || record.SectionLength <= 0 {
		return 0
	}

	totalUnitCost := 0.0
	area := record.SectionLength * 7.5

	if record.IRIScore > 0 {
		iriUnitCost := ps.getIRIUnitCost(record.IRIScore)
		totalUnitCost += iriUnitCost * (100 - float64(record.IRIScore)) / 100
	}

	if record.RutScore > 0 {
		rutUnitCost := ps.getRutUnitCost(record.RutScore)
		totalUnitCost += rutUnitCost * (100 - float64(record.RutScore)) / 100
	}

	if record.CrackScore > 0 {
		crackUnitCost := ps.getCrackUnitCost(record.CrackScore)
		totalUnitCost += crackUnitCost * (100 - float64(record.CrackScore)) / 100
	}

	cost := totalUnitCost * area / 10
	return math.Round(cost*100) / 100
}

func (ps *PrioritySorter) getIRIUnitCost(score int) float64 {
	switch {
	case score >= 80:
		return maintenanceUnitCost["IRI"]["微表处"]
	case score >= 60:
		return maintenanceUnitCost["IRI"]["薄层罩面"]
	default:
		return maintenanceUnitCost["IRI"]["铣刨重铺"]
	}
}

func (ps *PrioritySorter) getRutUnitCost(score int) float64 {
	switch {
	case score >= 70:
		return maintenanceUnitCost["RUT"]["车辙填充"]
	default:
		return maintenanceUnitCost["RUT"]["结构补强"]
	}
}

func (ps *PrioritySorter) getCrackUnitCost(score int) float64 {
	switch {
	case score >= 85:
		return maintenanceUnitCost["CRACK"]["裂缝灌封"]
	case score >= 65:
		return maintenanceUnitCost["CRACK"]["局部修补"]
	default:
		return maintenanceUnitCost["CRACK"]["铣刨重铺"]
	}
}

func (ps *PrioritySorter) AllocateBudget(records []*storage.PavementRecord, totalBudget float64) (*BudgetPlan, error) {
	if err := validator.ValidateBudget(totalBudget); err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return nil, pverrors.NewBudgetError(
			pverrors.ErrBudgetNoValidSection,
			"没有可用的路段数据进行预算分配",
			"请先导入检测数据并完成病害判定",
			nil,
		)
	}

	if totalBudget == 0 {
		plan := &BudgetPlan{
			TotalBudget:     0,
			AllocatedBudget: 0,
			RemainingBudget: 0,
			Allocations:     make([]*storage.BudgetAllocation, 0),
		}
		for _, r := range records {
			plan.Allocations = append(plan.Allocations, &storage.BudgetAllocation{
				RecordID:      r.ID,
				RouteID:       r.RouteID,
				StartStation:  validator.FormatMetersToStation(r.StartStation),
				EndStation:    validator.FormatMetersToStation(r.EndStation),
				DiseaseGrade:  r.DiseaseGrade,
				SectionLength: r.SectionLength,
				PriorityScore: r.PriorityScore,
				EstimatedCost: r.EstimatedCost,
				AllocatedFund: 0,
				FundingRatio:  0,
				FundingStatus: "未分配",
			})
		}
		plan.UnfundedCount = len(plan.Allocations)
		return plan, nil
	}

	sortedResults := ps.SortByPriority(records, 0)

	plan := &BudgetPlan{
		TotalBudget:     totalBudget,
		RemainingBudget: totalBudget,
		Allocations:     make([]*storage.BudgetAllocation, 0, len(sortedResults)),
	}

	for _, pr := range sortedResults {
		r := pr.Record
		alloc := &storage.BudgetAllocation{
			RecordID:      r.ID,
			RouteID:       r.RouteID,
			StartStation:  validator.FormatMetersToStation(r.StartStation),
			EndStation:    validator.FormatMetersToStation(r.EndStation),
			DiseaseGrade:  r.DiseaseGrade,
			SectionLength: r.SectionLength,
			PriorityScore: r.PriorityScore,
			EstimatedCost: pr.EstimatedCost,
		}

		if plan.RemainingBudget >= pr.EstimatedCost {
			alloc.AllocatedFund = pr.EstimatedCost
			alloc.FundingRatio = 100.0
			alloc.FundingStatus = "全额资助"
			plan.AllocatedBudget += pr.EstimatedCost
			plan.RemainingBudget -= pr.EstimatedCost
			plan.FundedCount++
		} else if plan.RemainingBudget > 0 {
			partialRatio := (plan.RemainingBudget / pr.EstimatedCost) * 100
			alloc.AllocatedFund = plan.RemainingBudget
			alloc.FundingRatio = math.Round(partialRatio*100) / 100
			alloc.FundingStatus = "部分资助"
			plan.AllocatedBudget += plan.RemainingBudget
			plan.RemainingBudget = 0
			plan.PartiallyFunded++
		} else {
			alloc.AllocatedFund = 0
			alloc.FundingRatio = 0
			alloc.FundingStatus = "预算不足"
			plan.UnfundedCount++
		}

		plan.Allocations = append(plan.Allocations, alloc)
	}

	plan.AllocatedBudget = math.Round(plan.AllocatedBudget*100) / 100
	plan.RemainingBudget = math.Round(plan.RemainingBudget*100) / 100

	return plan, nil
}

func (ps *PrioritySorter) GetPriorityDescription(score float64) string {
	switch {
	case score >= 85:
		return "极高优先级"
	case score >= 70:
		return "高优先级"
	case score >= 50:
		return "中等优先级"
	case score >= 30:
		return "较低优先级"
	default:
		return "低优先级"
	}
}

func (ps *PrioritySorter) GetPriorityColor(score float64) string {
	switch {
	case score >= 85:
		return "\033[41;37m"
	case score >= 70:
		return "\033[31m"
	case score >= 50:
		return "\033[33m"
	case score >= 30:
		return "\033[36m"
	default:
		return "\033[32m"
	}
}

package engine

import (
	"testing"

	"pavement/internal/storage"
)

func TestNewPrioritySorter(t *testing.T) {
	ps := NewPrioritySorter()
	if ps == nil {
		t.Fatal("NewPrioritySorter() returned nil")
	}
	if ps.GradeWeight != DefaultGradeWeight {
		t.Errorf("GradeWeight = %.2f, want %.2f", ps.GradeWeight, DefaultGradeWeight)
	}
	if ps.TrafficWeight != DefaultTrafficWeight {
		t.Errorf("TrafficWeight = %.2f, want %.2f", ps.TrafficWeight, DefaultTrafficWeight)
	}
}

func TestSetWeights(t *testing.T) {
	ps := NewPrioritySorter()
	tests := []struct {
		name       string
		gradeW     float64
		trafficW   float64
		importanceW float64
		costW      float64
		wantErr    bool
	}{
		{"有效权重", 0.5, 0.25, 0.15, 0.10, false},
		{"全给等级", 1.0, 0.0, 0.0, 0.0, false},
		{"和不等于1", 0.4, 0.3, 0.2, 0.2, true},
		{"负权重", -0.1, 0.5, 0.4, 0.2, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ps.SetWeights(tt.gradeW, tt.trafficW, tt.importanceW, tt.costW)
			if (err != nil) != tt.wantErr {
				t.Errorf("SetWeights() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCalculatePriority_NilRecord(t *testing.T) {
	ps := NewPrioritySorter()
	_, err := ps.CalculatePriority(nil)
	if err == nil {
		t.Error("CalculatePriority(nil) should return error")
	}
}

func TestCalculatePriority_GradeScores(t *testing.T) {
	ps := NewPrioritySorter()
	tests := []struct {
		name       string
		grade      string
		totalScore float64
		traffic    float64
		importance float64
	}{
		{"优等", "优", 90, 30000, 2},
		{"良等", "良", 75, 20000, 1.5},
		{"中等", "中", 60, 15000, 1},
		{"差等", "差", 30, 5000, 0.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			record := &storage.PavementRecord{
				DiseaseGrade:  tt.grade,
				TotalScore:    tt.totalScore,
				TrafficVolume: tt.traffic,
				Importance:    tt.importance,
				SectionLength: 1.0,
				IRIScore:      50,
				RutScore:      50,
				CrackScore:    50,
			}
			score, err := ps.CalculatePriority(record)
			if err != nil {
				t.Fatalf("CalculatePriority() error: %v", err)
			}
			if score <= 0 {
				t.Errorf("CalculatePriority() score = %.2f, want > 0", score)
			}
			if record.PriorityScore != score {
				t.Errorf("Record PriorityScore = %.2f, want %.2f", record.PriorityScore, score)
			}
		})
	}
}

func TestCalculatePriority_DifferenceBetweenGrades(t *testing.T) {
	ps := NewPrioritySorter()
	goodRecord := &storage.PavementRecord{
		DiseaseGrade:  "优",
		TotalScore:    90,
		TrafficVolume: 10000,
		Importance:    1,
		SectionLength: 1.0,
		IRIScore:      90,
		RutScore:      90,
		CrackScore:    90,
	}
	badRecord := &storage.PavementRecord{
		DiseaseGrade:  "差",
		TotalScore:    30,
		TrafficVolume: 40000,
		Importance:    3,
		SectionLength: 1.0,
		IRIScore:      30,
		RutScore:      30,
		CrackScore:    30,
	}

	goodScore, _ := ps.CalculatePriority(goodRecord)
	badScore, _ := ps.CalculatePriority(badRecord)

	if badScore <= goodScore {
		t.Errorf("差等路段优先级 (%.2f) 应高于优等路段 (%.2f)", badScore, goodScore)
	}
}

func TestBatchCalculate(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{DiseaseGrade: "差", TotalScore: 30, TrafficVolume: 40000, Importance: 3, SectionLength: 1.0, IRIScore: 30, RutScore: 30, CrackScore: 30},
		{DiseaseGrade: "良", TotalScore: 75, TrafficVolume: 20000, Importance: 2, SectionLength: 1.0, IRIScore: 80, RutScore: 80, CrackScore: 80},
	}
	success, failed := ps.BatchCalculate(records)
	if success != 2 {
		t.Errorf("BatchCalculate success = %d, want 2", success)
	}
	if failed != 0 {
		t.Errorf("BatchCalculate failed = %d, want 0", failed)
	}
}

func TestSortByPriority(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{PriorityScore: 80.0, EstimatedCost: 500, DiseaseGrade: "差"},
		{PriorityScore: 50.0, EstimatedCost: 300, DiseaseGrade: "良"},
		{PriorityScore: 90.0, EstimatedCost: 700, DiseaseGrade: "差"},
		{PriorityScore: 30.0, EstimatedCost: 100, DiseaseGrade: "优"},
	}

	results := ps.SortByPriority(records, 0)
	if len(results) != 4 {
		t.Fatalf("SortByPriority returned %d results, want 4", len(results))
	}
	if results[0].PriorityScore < results[1].PriorityScore {
		t.Errorf("Results not sorted by priority desc: [0]=%.2f, [1]=%.2f",
			results[0].PriorityScore, results[1].PriorityScore)
	}
	if results[0].Rank != 1 {
		t.Errorf("First result rank = %d, want 1", results[0].Rank)
	}
}

func TestSortByPriority_TopN(t *testing.T) {
	ps := NewPrioritySorter()
	records := make([]*storage.PavementRecord, 10)
	for i := range records {
		records[i] = &storage.PavementRecord{
			PriorityScore: float64(10 - i),
			EstimatedCost: float64(i * 100),
		}
	}

	results := ps.SortByPriority(records, 5)
	if len(results) != 5 {
		t.Errorf("SortByPriority top5 returned %d results, want 5", len(results))
	}
}

func TestEstimateMaintenanceCost(t *testing.T) {
	ps := NewPrioritySorter()
	tests := []struct {
		name      string
		record    *storage.PavementRecord
		wantAbove float64
	}{
		{
			name: "差等路段成本较高",
			record: &storage.PavementRecord{
				SectionLength: 1.0,
				IRIScore:      20,
				RutScore:      20,
				CrackScore:    20,
			},
			wantAbove: 100,
		},
		{
			name: "优等路段成本较低",
			record: &storage.PavementRecord{
				SectionLength: 1.0,
				IRIScore:      95,
				RutScore:      95,
				CrackScore:    95,
			},
			wantAbove: 0,
		},
		{
			name: "零长度返回零",
			record: &storage.PavementRecord{
				SectionLength: 0,
				IRIScore:      50,
				RutScore:      50,
				CrackScore:    50,
			},
			wantAbove: -1,
		},
		{
			name:      "nil记录返回零",
			record:    nil,
			wantAbove: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cost := ps.EstimateMaintenanceCost(tt.record)
			if tt.wantAbove < 0 {
				if cost != 0 {
					t.Errorf("EstimateMaintenanceCost() = %.2f, want 0", cost)
				}
			} else if cost < tt.wantAbove {
				t.Errorf("EstimateMaintenanceCost() = %.2f, want >= %.2f", cost, tt.wantAbove)
			}
		})
	}
}

func TestEstimateMaintenanceCost_SeverityAffectsCost(t *testing.T) {
	ps := NewPrioritySorter()
	lightRecord := &storage.PavementRecord{
		SectionLength: 1.0,
		IRIScore:      90,
		RutScore:      90,
		CrackScore:    90,
	}
	heavyRecord := &storage.PavementRecord{
		SectionLength: 1.0,
		IRIScore:      20,
		RutScore:      20,
		CrackScore:    20,
	}

	lightCost := ps.EstimateMaintenanceCost(lightRecord)
	heavyCost := ps.EstimateMaintenanceCost(heavyRecord)

	if heavyCost <= lightCost {
		t.Errorf("差等路段费用 (%.2f) 应高于优等路段 (%.2f)", heavyCost, lightCost)
	}
}

func TestAllocateBudget(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{ID: 1, RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, DiseaseGrade: "差", TotalScore: 30, TrafficVolume: 40000, Importance: 3, PriorityScore: 80, EstimatedCost: 600, IRIScore: 30, RutScore: 30, CrackScore: 30},
		{ID: 2, RouteID: "G108", StartStation: 2000, EndStation: 3000, SectionLength: 1.0, DiseaseGrade: "良", TotalScore: 75, TrafficVolume: 20000, Importance: 2, PriorityScore: 50, EstimatedCost: 200, IRIScore: 80, RutScore: 80, CrackScore: 80},
		{ID: 3, RouteID: "S305", StartStation: 3000, EndStation: 4000, SectionLength: 1.0, DiseaseGrade: "优", TotalScore: 90, TrafficVolume: 10000, Importance: 1, PriorityScore: 30, EstimatedCost: 50, IRIScore: 90, RutScore: 90, CrackScore: 90},
	}

	plan, err := ps.AllocateBudget(records, 700)
	if err != nil {
		t.Fatalf("AllocateBudget() error: %v", err)
	}

	if plan.TotalBudget != 700 {
		t.Errorf("TotalBudget = %.2f, want 700", plan.TotalBudget)
	}
	if plan.AllocatedBudget <= 0 {
		t.Errorf("AllocatedBudget = %.2f, want > 0", plan.AllocatedBudget)
	}
	if plan.AllocatedBudget > 700 {
		t.Errorf("AllocatedBudget = %.2f, exceeds TotalBudget 700", plan.AllocatedBudget)
	}
	if len(plan.Allocations) != 3 {
		t.Errorf("Allocations count = %d, want 3", len(plan.Allocations))
	}
}

func TestAllocateBudget_ZeroBudget(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{ID: 1, RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, DiseaseGrade: "差", PriorityScore: 80, EstimatedCost: 600},
	}

	plan, err := ps.AllocateBudget(records, 0)
	if err != nil {
		t.Fatalf("AllocateBudget() with zero budget error: %v", err)
	}
	if plan.AllocatedBudget != 0 {
		t.Errorf("AllocatedBudget = %.2f, want 0", plan.AllocatedBudget)
	}
	if plan.UnfundedCount != 1 {
		t.Errorf("UnfundedCount = %d, want 1", plan.UnfundedCount)
	}
}

func TestAllocateBudget_SufficientBudget(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{ID: 1, RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, DiseaseGrade: "差", PriorityScore: 80, EstimatedCost: 500},
		{ID: 2, RouteID: "G108", StartStation: 2000, EndStation: 3000, SectionLength: 1.0, DiseaseGrade: "良", PriorityScore: 50, EstimatedCost: 200},
	}

	plan, err := ps.AllocateBudget(records, 10000)
	if err != nil {
		t.Fatalf("AllocateBudget() error: %v", err)
	}
	if plan.FundedCount != 2 {
		t.Errorf("FundedCount = %d, want 2", plan.FundedCount)
	}
	if plan.PartiallyFunded != 0 {
		t.Errorf("PartiallyFunded = %d, want 0", plan.PartiallyFunded)
	}
}

func TestAllocateBudget_PartialFunding(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{ID: 1, RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, DiseaseGrade: "差", PriorityScore: 80, EstimatedCost: 500},
		{ID: 2, RouteID: "G108", StartStation: 2000, EndStation: 3000, SectionLength: 1.0, DiseaseGrade: "良", PriorityScore: 50, EstimatedCost: 300},
	}

	plan, err := ps.AllocateBudget(records, 600)
	if err != nil {
		t.Fatalf("AllocateBudget() error: %v", err)
	}
	if plan.FundedCount != 1 {
		t.Errorf("FundedCount = %d, want 1", plan.FundedCount)
	}
}

func TestAllocateBudget_NegativeBudget(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{ID: 1, RouteID: "G108", StartStation: 1000, EndStation: 2000, SectionLength: 1.0, DiseaseGrade: "差", PriorityScore: 80, EstimatedCost: 500},
	}
	_, err := ps.AllocateBudget(records, -100)
	if err == nil {
		t.Error("AllocateBudget with negative budget should return error")
	}
}

func TestAllocateBudget_EmptyRecords(t *testing.T) {
	ps := NewPrioritySorter()
	_, err := ps.AllocateBudget([]*storage.PavementRecord{}, 1000)
	if err == nil {
		t.Error("AllocateBudget with empty records should return error")
	}
}

func TestPriorityOrder_HigherGradeFirst(t *testing.T) {
	ps := NewPrioritySorter()
	records := []*storage.PavementRecord{
		{DiseaseGrade: "优", TotalScore: 90, TrafficVolume: 5000, Importance: 1, SectionLength: 1.0, IRIScore: 90, RutScore: 90, CrackScore: 90},
		{DiseaseGrade: "差", TotalScore: 30, TrafficVolume: 40000, Importance: 3, SectionLength: 1.0, IRIScore: 30, RutScore: 30, CrackScore: 30},
		{DiseaseGrade: "良", TotalScore: 75, TrafficVolume: 20000, Importance: 2, SectionLength: 1.0, IRIScore: 80, RutScore: 80, CrackScore: 80},
	}

	for _, r := range records {
		ps.CalculatePriority(r)
	}

	results := ps.SortByPriority(records, 0)
	if results[0].Record.DiseaseGrade != "差" {
		t.Errorf("Highest priority should be '差', got %q", results[0].Record.DiseaseGrade)
	}
}

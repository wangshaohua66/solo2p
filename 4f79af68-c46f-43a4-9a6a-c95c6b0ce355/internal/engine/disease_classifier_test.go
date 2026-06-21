package engine

import (
	"testing"

	"pavement/internal/storage"
)

func TestNewDiseaseClassifier(t *testing.T) {
	c := NewDiseaseClassifier()
	if c == nil {
		t.Fatal("NewDiseaseClassifier() returned nil")
	}
	if c.GetStandardName() != StandardJTG_H20_2018 {
		t.Errorf("GetStandardName() = %q, want %q", c.GetStandardName(), StandardJTG_H20_2018)
	}
}

func TestClassify_NilRecord(t *testing.T) {
	c := NewDiseaseClassifier()
	_, err := c.Classify(nil)
	if err == nil {
		t.Error("Classify(nil) should return error")
	}
}

func TestClassify_NegativeIRI(t *testing.T) {
	c := NewDiseaseClassifier()
	record := &storage.PavementRecord{IRI: -1.0, RutDepth: 5.0, CrackDensity: 3.0}
	_, err := c.Classify(record)
	if err == nil {
		t.Error("Classify with negative IRI should return error")
	}
}

func TestClassify_NegativeRutDepth(t *testing.T) {
	c := NewDiseaseClassifier()
	record := &storage.PavementRecord{IRI: 2.0, RutDepth: -1.0, CrackDensity: 3.0}
	_, err := c.Classify(record)
	if err == nil {
		t.Error("Classify with negative rut depth should return error")
	}
}

func TestClassify_NegativeCrackDensity(t *testing.T) {
	c := NewDiseaseClassifier()
	record := &storage.PavementRecord{IRI: 2.0, RutDepth: 5.0, CrackDensity: -1.0}
	_, err := c.Classify(record)
	if err == nil {
		t.Error("Classify with negative crack density should return error")
	}
}

func TestClassify_IRIScore(t *testing.T) {
	c := NewDiseaseClassifier()
	tests := []struct {
		name      string
		iri       float64
		wantScore int
	}{
		{"极优IRI 1.0", 1.0, 100},
		{"优IRI 1.5", 1.5, 100},
		{"良IRI 2.0", 2.0, 90},
		{"IRI 2.5", 2.5, 80},
		{"IRI 3.0", 3.0, 70},
		{"IRI 3.5", 3.5, 60},
		{"IRI 4.5", 4.5, 50},
		{"IRI 6.0", 6.0, 40},
		{"IRI 8.0", 8.0, 30},
		{"IRI 10.0", 10.0, 20},
		{"IRI 12.0", 12.0, 10},
		{"极差IRI 15.0", 15.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			record := &storage.PavementRecord{IRI: tt.iri, RutDepth: 0, CrackDensity: 0}
			result, err := c.Classify(record)
			if err != nil {
				t.Fatalf("Classify() error: %v", err)
			}
			if result.IRIScore != tt.wantScore {
				t.Errorf("IRI=%.1f: score = %d, want %d", tt.iri, result.IRIScore, tt.wantScore)
			}
		})
	}
}

func TestClassify_RutScore(t *testing.T) {
	c := NewDiseaseClassifier()
	tests := []struct {
		name      string
		rut       float64
		wantScore int
	}{
		{"极优车辙 2", 2, 100},
		{"优车辙 5", 5, 100},
		{"良车辙 8", 8, 90},
		{"车辙 10", 10, 80},
		{"车辙 12", 12, 70},
		{"车辙 15", 15, 60},
		{"车辙 20", 20, 50},
		{"车辙 25", 25, 40},
		{"车辙 30", 30, 30},
		{"车辙 35", 35, 20},
		{"车辙 40", 40, 10},
		{"极差车辙 50", 50, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			record := &storage.PavementRecord{IRI: 0, RutDepth: tt.rut, CrackDensity: 0}
			result, err := c.Classify(record)
			if err != nil {
				t.Fatalf("Classify() error: %v", err)
			}
			if result.RutScore != tt.wantScore {
				t.Errorf("RutDepth=%.1f: score = %d, want %d", tt.rut, result.RutScore, tt.wantScore)
			}
		})
	}
}

func TestClassify_CrackScore(t *testing.T) {
	c := NewDiseaseClassifier()
	tests := []struct {
		name      string
		crack     float64
		wantScore int
	}{
		{"极优裂缝 0.5", 0.5, 100},
		{"优裂缝 1", 1, 100},
		{"良裂缝 3", 3, 90},
		{"裂缝 5", 5, 80},
		{"裂缝 8", 8, 70},
		{"裂缝 10", 10, 60},
		{"裂缝 15", 15, 50},
		{"裂缝 20", 20, 40},
		{"裂缝 25", 25, 30},
		{"裂缝 30", 30, 20},
		{"裂缝 35", 35, 10},
		{"极差裂缝 40", 40, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			record := &storage.PavementRecord{IRI: 0, RutDepth: 0, CrackDensity: tt.crack}
			result, err := c.Classify(record)
			if err != nil {
				t.Fatalf("Classify() error: %v", err)
			}
			if result.CrackScore != tt.wantScore {
				t.Errorf("CrackDensity=%.1f: score = %d, want %d", tt.crack, result.CrackScore, tt.wantScore)
			}
		})
	}
}

func TestClassify_GradeDetermination(t *testing.T) {
	c := NewDiseaseClassifier()
	tests := []struct {
		name       string
		iri        float64
		rut        float64
		crack      float64
		wantGrade  string
	}{
		{"全优", 1.0, 3, 0.5, "优"},
		{"良好", 3.5, 10, 5, "良"},
		{"中等", 3.5, 15, 10, "中"},
		{"差等", 8.0, 25, 20, "差"},
		{"极差", 12.0, 40, 35, "差"},
		{"边界优85", 1.5, 5, 1, "优"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			record := &storage.PavementRecord{IRI: tt.iri, RutDepth: tt.rut, CrackDensity: tt.crack}
			result, err := c.Classify(record)
			if err != nil {
				t.Fatalf("Classify() error: %v", err)
			}
			if result.DiseaseGrade != tt.wantGrade {
				t.Errorf("IRI=%.1f Rut=%.1f Crack=%.1f: grade=%q, want=%q (totalScore=%.2f)",
					tt.iri, tt.rut, tt.crack, result.DiseaseGrade, tt.wantGrade, result.TotalScore)
			}
		})
	}
}

func TestClassify_TotalScoreCalculation(t *testing.T) {
	c := NewDiseaseClassifier()
	record := &storage.PavementRecord{IRI: 1.0, RutDepth: 3.0, CrackDensity: 0.5}
	result, err := c.Classify(record)
	if err != nil {
		t.Fatalf("Classify() error: %v", err)
	}
	if result.IRIScore != 100 || result.RutScore != 100 || result.CrackScore != 100 {
		t.Errorf("Expected all scores 100, got IRI=%d Rut=%d Crack=%d",
			result.IRIScore, result.RutScore, result.CrackScore)
	}
	if result.TotalScore != 100.0 {
		t.Errorf("TotalScore = %.2f, want 100.00", result.TotalScore)
	}
}

func TestClassify_UpdatesRecord(t *testing.T) {
	c := NewDiseaseClassifier()
	record := &storage.PavementRecord{IRI: 2.0, RutDepth: 5.0, CrackDensity: 3.0}
	result, err := c.Classify(record)
	if err != nil {
		t.Fatalf("Classify() error: %v", err)
	}
	if record.IRIScore != result.IRIScore {
		t.Errorf("Record IRIScore = %d, want %d", record.IRIScore, result.IRIScore)
	}
	if record.DiseaseGrade != result.DiseaseGrade {
		t.Errorf("Record DiseaseGrade = %q, want %q", record.DiseaseGrade, result.DiseaseGrade)
	}
	if record.TotalScore != result.TotalScore {
		t.Errorf("Record TotalScore = %.2f, want %.2f", record.TotalScore, result.TotalScore)
	}
}

func TestBatchClassify(t *testing.T) {
	c := NewDiseaseClassifier()
	records := []*storage.PavementRecord{
		{IRI: 1.0, RutDepth: 3.0, CrackDensity: 0.5},
		{IRI: 2.0, RutDepth: 5.0, CrackDensity: 3.0},
		{IRI: 5.0, RutDepth: 15.0, CrackDensity: 10.0},
		{IRI: 12.0, RutDepth: 40.0, CrackDensity: 35.0},
	}
	success, failed := c.BatchClassify(records)
	if success != 4 {
		t.Errorf("BatchClassify success = %d, want 4", success)
	}
	if failed != 0 {
		t.Errorf("BatchClassify failed = %d, want 0", failed)
	}
}

func TestBatchClassify_WithInvalid(t *testing.T) {
	c := NewDiseaseClassifier()
	records := []*storage.PavementRecord{
		{IRI: 1.0, RutDepth: 3.0, CrackDensity: 0.5},
		{IRI: -1.0, RutDepth: 5.0, CrackDensity: 3.0},
		{IRI: 5.0, RutDepth: -1.0, CrackDensity: 10.0},
		{IRI: 12.0, RutDepth: 40.0, CrackDensity: 35.0},
	}
	success, failed := c.BatchClassify(records)
	if success != 2 {
		t.Errorf("BatchClassify success = %d, want 2", success)
	}
	if failed != 2 {
		t.Errorf("BatchClassify failed = %d, want 2", failed)
	}
}

func TestSetCustomWeights(t *testing.T) {
	c := NewDiseaseClassifier()
	tests := []struct {
		name    string
		iri     float64
		rut     float64
		crack   float64
		wantErr bool
	}{
		{"有效权重", 0.5, 0.3, 0.2, false},
		{"全给IRI", 1.0, 0.0, 0.0, false},
		{"和不等于1", 0.5, 0.3, 0.3, true},
		{"负权重", -0.1, 0.6, 0.5, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := c.SetCustomWeights(tt.iri, tt.rut, tt.crack)
			if (err != nil) != tt.wantErr {
				t.Errorf("SetCustomWeights(%.1f, %.1f, %.1f) error = %v, wantErr %v",
					tt.iri, tt.rut, tt.crack, err, tt.wantErr)
			}
		})
	}
}

func TestSetCustomWeights_AffectsResult(t *testing.T) {
	c := NewDiseaseClassifier()
	err := c.SetCustomWeights(1.0, 0.0, 0.0)
	if err != nil {
		t.Fatalf("SetCustomWeights() error: %v", err)
	}

	record := &storage.PavementRecord{IRI: 1.0, RutDepth: 40.0, CrackDensity: 35.0}
	result, err := c.Classify(record)
	if err != nil {
		t.Fatalf("Classify() error: %v", err)
	}

	if result.TotalScore != 100.0 {
		t.Errorf("With IRI weight=1.0, TotalScore = %.2f, want 100.00", result.TotalScore)
	}
}

func TestSetCustomGradeThresholds(t *testing.T) {
	c := NewDiseaseClassifier()
	err := c.SetCustomGradeThresholds(90, 75, 60, 0)
	if err != nil {
		t.Fatalf("SetCustomGradeThresholds() error: %v", err)
	}

	record := &storage.PavementRecord{IRI: 2.5, RutDepth: 8, CrackDensity: 3}
	result, err := c.Classify(record)
	if err != nil {
		t.Fatalf("Classify() error: %v", err)
	}

	if result.DiseaseGrade != "良" {
		t.Errorf("With custom thresholds, grade = %q, totalScore = %.2f", result.DiseaseGrade, result.TotalScore)
	}
}

func TestGetScoreDescription(t *testing.T) {
	c := NewDiseaseClassifier()
	tests := []struct {
		score int
		want  string
	}{
		{100, "优秀"},
		{90, "优秀"},
		{85, "良好"},
		{75, "较好"},
		{65, "中等"},
		{55, "较差"},
		{45, "差"},
		{30, "危险"},
	}
	for _, tt := range tests {
		got := c.GetScoreDescription(tt.score)
		if got != tt.want {
			t.Errorf("GetScoreDescription(%d) = %q, want %q", tt.score, got, tt.want)
		}
	}
}

func TestGetGradeColor(t *testing.T) {
	c := NewDiseaseClassifier()
	colors := map[string]bool{
		c.GetGradeColor("优"): true,
		c.GetGradeColor("良"): true,
		c.GetGradeColor("中"): true,
		c.GetGradeColor("差"): true,
		c.GetGradeColor("X"):  true,
	}
	if len(colors) != 5 {
		t.Errorf("Expected 5 distinct color codes, got %d", len(colors))
	}
}

func TestBatchClassify_Performance(t *testing.T) {
	c := NewDiseaseClassifier()
	records := make([]*storage.PavementRecord, 1000)
	for i := range records {
		records[i] = &storage.PavementRecord{
			IRI:          float64(i%10 + 1),
			RutDepth:     float64(i % 15),
			CrackDensity: float64(i % 20),
		}
	}

	success, failed := c.BatchClassify(records)
	if success != 1000 {
		t.Errorf("BatchClassify success = %d, want 1000", success)
	}
	if failed != 0 {
		t.Errorf("BatchClassify failed = %d, want 0", failed)
	}
}

func TestClassify_ZeroValues(t *testing.T) {
	c := NewDiseaseClassifier()
	record := &storage.PavementRecord{IRI: 0, RutDepth: 0, CrackDensity: 0}
	result, err := c.Classify(record)
	if err != nil {
		t.Fatalf("Classify() error: %v", err)
	}
	if result.DiseaseGrade != "优" {
		t.Errorf("Zero values should be grade '优', got %q", result.DiseaseGrade)
	}
	if result.TotalScore != 100.0 {
		t.Errorf("Zero values TotalScore = %.2f, want 100.00", result.TotalScore)
	}
}

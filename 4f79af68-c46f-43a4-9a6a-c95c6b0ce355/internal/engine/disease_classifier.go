package engine

import (
	"fmt"
	"math"
	"sort"

	pverrors "pavement/internal/errors"
	"pavement/internal/storage"
)

type DiseaseClassifier struct {
	iriWeights    []float64
	rutWeights    []float64
	crackWeights  []float64
	gradeThresholds map[string]float64
}

type ClassifyResult struct {
	IRIScore    int
	RutScore    int
	CrackScore  int
	TotalScore  float64
	DiseaseGrade string
}

const (
	StandardJTG_H20_2018 = "JTG H20-2018"
)

var iriThresholds = []struct {
	max   float64
	score int
}{
	{1.5, 100},
	{2.0, 90},
	{2.5, 80},
	{3.0, 70},
	{3.5, 60},
	{4.5, 50},
	{6.0, 40},
	{8.0, 30},
	{10.0, 20},
	{12.0, 10},
	{math.MaxFloat64, 0},
}

var rutThresholds = []struct {
	max   float64
	score int
}{
	{5, 100},
	{8, 90},
	{10, 80},
	{12, 70},
	{15, 60},
	{20, 50},
	{25, 40},
	{30, 30},
	{35, 20},
	{40, 10},
	{math.MaxFloat64, 0},
}

var crackThresholds = []struct {
	max   float64
	score int
}{
	{1, 100},
	{3, 90},
	{5, 80},
	{8, 70},
	{10, 60},
	{15, 50},
	{20, 40},
	{25, 30},
	{30, 20},
	{35, 10},
	{math.MaxFloat64, 0},
}

func NewDiseaseClassifier() *DiseaseClassifier {
	return &DiseaseClassifier{
		iriWeights:   []float64{0.4},
		rutWeights:   []float64{0.3},
		crackWeights: []float64{0.3},
		gradeThresholds: map[string]float64{
			"优": 85.0,
			"良": 70.0,
			"中": 55.0,
			"差": 0.0,
		},
	}
}

func (c *DiseaseClassifier) Classify(record *storage.PavementRecord) (*ClassifyResult, error) {
	if record == nil {
		return nil, pverrors.NewClassifyError(
			pverrors.ErrClassifyMissingData,
			"待判定记录为空",
			"请确保传入有效的路面检测记录",
			nil,
		)
	}

	if record.IRI < 0 {
		return nil, pverrors.NewClassifyError(
			pverrors.ErrClassifyInvalidIRI,
			fmt.Sprintf("IRI值不合法: %.2f", record.IRI),
			"IRI值应大于等于0，请检查原始检测数据",
			nil,
		)
	}

	if record.RutDepth < 0 {
		return nil, pverrors.NewClassifyError(
			pverrors.ErrClassifyInvalidRut,
			fmt.Sprintf("车辙深度不合法: %.1f", record.RutDepth),
			"车辙深度应大于等于0，请检查原始检测数据",
			nil,
		)
	}

	if record.CrackDensity < 0 {
		return nil, pverrors.NewClassifyError(
			pverrors.ErrClassifyInvalidCrack,
			fmt.Sprintf("裂缝密度不合法: %.2f", record.CrackDensity),
			"裂缝密度应大于等于0，请检查原始检测数据",
			nil,
		)
	}

	iriScore := c.calculateIRIScore(record.IRI)
	rutScore := c.calculateRutScore(record.RutDepth)
	crackScore := c.calculateCrackScore(record.CrackDensity)

	totalScore := c.calculateTotalScore(iriScore, rutScore, crackScore)
	grade := c.determineGrade(totalScore)

	result := &ClassifyResult{
		IRIScore:     iriScore,
		RutScore:     rutScore,
		CrackScore:   crackScore,
		TotalScore:   totalScore,
		DiseaseGrade: grade,
	}

	record.IRIScore = iriScore
	record.RutScore = rutScore
	record.CrackScore = crackScore
	record.TotalScore = totalScore
	record.DiseaseGrade = grade

	return result, nil
}

func (c *DiseaseClassifier) BatchClassify(records []*storage.PavementRecord) (int, int) {
	success := 0
	failed := 0
	for _, record := range records {
		_, err := c.Classify(record)
		if err != nil {
			failed++
		} else {
			success++
		}
	}
	return success, failed
}

func (c *DiseaseClassifier) calculateIRIScore(iri float64) int {
	for _, t := range iriThresholds {
		if iri <= t.max {
			return t.score
		}
	}
	return 0
}

func (c *DiseaseClassifier) calculateRutScore(rut float64) int {
	for _, t := range rutThresholds {
		if rut <= t.max {
			return t.score
		}
	}
	return 0
}

func (c *DiseaseClassifier) calculateCrackScore(crack float64) int {
	for _, t := range crackThresholds {
		if crack <= t.max {
			return t.score
		}
	}
	return 0
}

func (c *DiseaseClassifier) calculateTotalScore(iriScore, rutScore, crackScore int) float64 {
	total := float64(iriScore)*c.iriWeights[0] +
		float64(rutScore)*c.rutWeights[0] +
		float64(crackScore)*c.crackWeights[0]
	return math.Round(total*100) / 100
}

func (c *DiseaseClassifier) determineGrade(totalScore float64) string {
	grades := []struct {
		name       string
		threshold  float64
	}{
		{"优", c.gradeThresholds["优"]},
		{"良", c.gradeThresholds["良"]},
		{"中", c.gradeThresholds["中"]},
		{"差", c.gradeThresholds["差"]},
	}
	for _, g := range grades {
		if totalScore >= g.threshold {
			return g.name
		}
	}
	return "差"
}

func (c *DiseaseClassifier) GetStandardName() string {
	return StandardJTG_H20_2018
}

func (c *DiseaseClassifier) GetScoreDescription(score int) string {
	switch {
	case score >= 90:
		return "优秀"
	case score >= 80:
		return "良好"
	case score >= 70:
		return "较好"
	case score >= 60:
		return "中等"
	case score >= 50:
		return "较差"
	case score >= 40:
		return "差"
	default:
		return "危险"
	}
}

func (c *DiseaseClassifier) GetGradeColor(grade string) string {
	switch grade {
	case "优":
		return "\033[32m"
	case "良":
		return "\033[36m"
	case "中":
		return "\033[33m"
	case "差":
		return "\033[31m"
	default:
		return "\033[0m"
	}
}

func (c *DiseaseClassifier) SetCustomWeights(iriWeight, rutWeight, crackWeight float64) error {
	total := iriWeight + rutWeight + crackWeight
	if total != 1.0 {
		return pverrors.NewClassifyError(
			pverrors.ErrClassifyStandardNotFound,
			fmt.Sprintf("权重之和不等于1: %.2f", total),
			"请确保IRI、车辙、裂缝三项权重之和为1.0",
			nil,
		)
	}
	if iriWeight < 0 || rutWeight < 0 || crackWeight < 0 {
		return pverrors.NewClassifyError(
			pverrors.ErrClassifyStandardNotFound,
			"权重不能为负数",
			"请确保所有指标权重为非负数",
			nil,
		)
	}
	c.iriWeights[0] = iriWeight
	c.rutWeights[0] = rutWeight
	c.crackWeights[0] = crackWeight
	return nil
}

func (c *DiseaseClassifier) SetCustomGradeThresholds(excellent, good, medium, poor float64) error {
	if !(excellent > good && good > medium && medium > poor) {
		return pverrors.NewClassifyError(
			pverrors.ErrClassifyStandardNotFound,
			"等级阈值不满足递减关系",
			"请确保阈值优>良>中>差",
			nil,
		)
	}
	c.gradeThresholds["优"] = excellent
	c.gradeThresholds["良"] = good
	c.gradeThresholds["中"] = medium
	c.gradeThresholds["差"] = poor
	return nil
}

func SortRecordsByScore(records []*storage.PavementRecord, ascending bool) {
	sort.Slice(records, func(i, j int) bool {
		if ascending {
			return records[i].TotalScore < records[j].TotalScore
		}
		return records[i].TotalScore > records[j].TotalScore
	})
}

func FilterRecordsByGrade(records []*storage.PavementRecord, grade string) []*storage.PavementRecord {
	if grade == "" {
		return records
	}
	filtered := make([]*storage.PavementRecord, 0)
	for _, r := range records {
		if r.DiseaseGrade == grade {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

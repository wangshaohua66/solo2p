package export

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	pverrors "pavement/internal/errors"
	"pavement/internal/engine"
	"pavement/internal/storage"
	"pavement/internal/validator"
)

type ReportGenerator struct {
	classifier *engine.DiseaseClassifier
	sorter     *engine.PrioritySorter
}

type ReportContext struct {
	Title            string
	GeneratedAt      time.Time
	GeneratedBy    string
	PeriodStart    *time.Time
	PeriodEnd      *time.Time
	StandardName   string
}

func NewReportGenerator() *ReportGenerator {
	return &ReportGenerator{
		classifier: engine.NewDiseaseClassifier(),
		sorter:     engine.NewPrioritySorter(),
	}
}

func (rg *ReportGenerator) GenerateMaintenanceReport(
	records []*storage.PavementRecord,
	budgetPlan *engine.BudgetPlan,
	statsByRoute []*storage.StatisticsResult,
	statsByCenter []*storage.StatisticsResult,
	statsByGrade []*storage.StatisticsResult,
	topPriority []*engine.PriorityResult,
	outputPath string,
) (string, error) {

	if len(records) == 0 {
		return "", pverrors.NewExportError(
			pverrors.ErrExportEmptyData,
			"缺少生成报告所需的数据",
			"请先导入检测数据并完成病害判定",
			nil,
		)
	}

	ctx := &ReportContext{
		Title:        "国省干线路面养护方案报告",
		GeneratedAt: time.Now(),
		GeneratedBy: "pavement CLI",
		StandardName: rg.classifier.GetStandardName(),
	}

	var sb strings.Builder

	rg.writeHeader(&sb, ctx)
	rg.writeDiseaseDistribution(&sb, records, statsByRoute, statsByCenter, statsByGrade)
	rg.writePriorityList(&sb, topPriority)
	rg.writeBudgetPlan(&sb, budgetPlan)
	rg.writeSummary(&sb, records, budgetPlan)

	content := sb.String()

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if dir != "." {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return "", pverrors.NewExportError(
					pverrors.ErrExportWriteFailed,
					fmt.Sprintf("创建报告目录失败: %s", dir),
					"请检查目录路径和权限设置",
					err,
				)
			}
		}
		if err := os.WriteFile(outputPath, []byte(content), 0644); err != nil {
			return "", pverrors.NewExportError(
				pverrors.ErrExportWriteFailed,
				fmt.Sprintf("写入报告文件失败: %s", outputPath),
				"请检查文件路径和权限设置",
				err,
			)
		}
		return outputPath, nil
	}

	tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("maintenance_report_%s.md", time.Now().Format("20060102_150405")))
	if err := os.WriteFile(tmpFile, []byte(content), 0644); err != nil {
		return "", pverrors.NewExportError(
			pverrors.ErrExportWriteFailed,
			fmt.Sprintf("写入临时报告失败: %s", tmpFile),
			"请检查系统临时目录权限",
			err,
		)
	}
	return tmpFile, nil
}

func (rg *ReportGenerator) writeHeader(sb *strings.Builder, ctx *ReportContext) {

	sb.WriteString("# ")
	sb.WriteString(ctx.Title)
	sb.WriteString("\n\n")

	sb.WriteString("---\n\n")

	sb.WriteString("## 报告基本信息\n\n")

	sb.WriteString("| 项目 | 内容 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 生成时间 | %s |\n", ctx.GeneratedAt.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("| 生成工具 | %s |\n", ctx.GeneratedBy))
	sb.WriteString(fmt.Sprintf("| 评定标准 | %s |\n", ctx.StandardName))
	sb.WriteString(fmt.Sprintf("| 算法版本 | v1.0.0 |\n"))
	sb.WriteString("\n")

	sb.WriteString("---\n\n")
}

func (rg *ReportGenerator) writeDiseaseDistribution(
	sb *strings.Builder,
	records []*storage.PavementRecord,
	statsByRoute []*storage.StatisticsResult,
	statsByCenter []*storage.StatisticsResult,
	statsByGrade []*storage.StatisticsResult,
) {

	totalCount := len(records)
	totalMileage := 0.0
	gradeCount := map[string]int{"优": 0, "良": 0, "中": 0, "差": 0}
	gradeMileage := map[string]float64{"优": 0, "良": 0, "中": 0, "差": 0}

	for _, r := range records {
		totalMileage += r.SectionLength
		gradeCount[r.DiseaseGrade]++
		gradeMileage[r.DiseaseGrade] += r.SectionLength
	}

	sb.WriteString("## 一、病害分布统计\n\n")

	sb.WriteString("### 1.1 总体概况\n\n")
	sb.WriteString(fmt.Sprintf("- **检测路段总数**: %d 段\n", totalCount))
	sb.WriteString(fmt.Sprintf("- **检测总里程**: %.2f 公里\n", totalMileage))
	sb.WriteString(fmt.Sprintf("- **平均PCI均值**: %.2f 分\n\n", calculateAverageScore(records)))

	sb.WriteString("### 1.2 病害等级分布\n\n")
	sb.WriteString("| 病害等级 | 路段数量(段) | 占比 | 里程(km) | 里程占比 |\n")
	sb.WriteString("|----------|-----------|------|---------|----------|\n")

	for _, grade := range []string{"优", "良", "中", "差"} {
		count := gradeCount[grade]
		mileage := gradeMileage[grade]
		countRatio := safePercent(float64(count), float64(totalCount))
		mileageRatio := safePercent(mileage, totalMileage)
		sb.WriteString(fmt.Sprintf("| %s | %d | %.2f%% | %.2f | %.2f%% |\n",
			grade, count, countRatio, mileage, mileageRatio))
	}
	sb.WriteString("\n")

	sb.WriteString("### 1.3 按路线分布统计\n\n")
	if len(statsByRoute) > 0 {
		sb.WriteString("| 路线编号 | 路段数 | 里程(km) | 里程占比 | 优 | 良 | 中 | 差 |\n")
		sb.WriteString("|----------|--------|---------|----------|-----|-----|-----|-----|\n")

		for _, s := range statsByRoute {
			sb.WriteString(fmt.Sprintf("| %s | %d | %.2f | %.2f%% | %d | %d | %d | %d |\n",
				s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio,
				s.Excellent, s.Good, s.Medium, s.Poor))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("### 1.4 按养护中心统计\n\n")
	if len(statsByCenter) > 0 {
		sb.WriteString("| 养护中心 | 路段数 | 里程(km) | 里程占比 | 优 | 良 | 中 | 差 |\n")
		sb.WriteString("|----------|--------|---------|----------|-----|-----|-----|-----|\n")

		for _, s := range statsByCenter {
			sb.WriteString(fmt.Sprintf("| %s | %d | %.2f | %.2f%% | %d | %d | %d | %d |\n",
				s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio,
				s.Excellent, s.Good, s.Medium, s.Poor))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")
}

func (rg *ReportGenerator) writePriorityList(
	sb *strings.Builder,
	topPriority []*engine.PriorityResult,
) {

	sb.WriteString("## 二、优先养护路段清单 (Top 50)\n\n")

	if len(topPriority) == 0 {
		sb.WriteString("> 当前没有优先级数据，请先运行优先级计算。\n\n")
		return
	}

	sb.WriteString(fmt.Sprintf("共统计 **%d** 条高优先级路段。\n\n", len(topPriority)))

	sb.WriteString("| 排名 | 路线编号 | 起止桩号 | 长度(km) | 病害等级 | PCI | 优先级评分 | 预估费用(元) | 养护中心 |\n")
	sb.WriteString("|------|----------|----------|---------|----------|-----|-----------|-------------|----------|\n")

	showCount := len(topPriority)
	if showCount > 50 {
		showCount = 50
	}

	for i := 0; i < showCount && i < len(topPriority); i++ {
		pr := topPriority[i]
		r := pr.Record
		startSta := validator.FormatMetersToStation(r.StartStation)
		endSta := validator.FormatMetersToStation(r.EndStation)
		stationRange := fmt.Sprintf("%s ~ %s", startSta, endSta)

		sb.WriteString(fmt.Sprintf("| %d | %s | %s | %.3f | %s | %.2f | %.2f | %.2f | %s |\n",
			pr.Rank, r.RouteID, stationRange, r.SectionLength,
			r.DiseaseGrade, r.TotalScore, pr.PriorityScore,
			pr.EstimatedCost, r.MaintenanceCenter))
	}
	sb.WriteString("\n")

	sb.WriteString("---\n\n")
}

func (rg *ReportGenerator) writeBudgetPlan(
	sb *strings.Builder,
	budgetPlan *engine.BudgetPlan,
) {

	sb.WriteString("## 三、预算分配方案\n\n")

	if budgetPlan == nil {
		sb.WriteString("> 未提供预算分配数据。\n\n")
		return
	}

	sb.WriteString("### 3.1 预算概览\n\n")
	sb.WriteString(fmt.Sprintf("- **总预算**: ¥%.2f 元\n", budgetPlan.TotalBudget))
	sb.WriteString(fmt.Sprintf("- **已分配**: ¥%.2f 元 (%.2f%%)\n",
		budgetPlan.AllocatedBudget,
		safePercent(budgetPlan.AllocatedBudget, budgetPlan.TotalBudget)))
	sb.WriteString(fmt.Sprintf("- **剩余预算**: ¥%.2f 元\n\n", budgetPlan.RemainingBudget))

	sb.WriteString("### 3.2 资助情况统计\n\n")
	sb.WriteString(fmt.Sprintf("- **全额资助路段**: %d 段\n", budgetPlan.FundedCount))
	sb.WriteString(fmt.Sprintf("- **部分资助路段**: %d 段\n", budgetPlan.PartiallyFunded))
	sb.WriteString(fmt.Sprintf("- **预算不足未资助**: %d 段\n\n", budgetPlan.UnfundedCount))

	sb.WriteString("### 3.3 资金分配明细\n\n")

	sb.WriteString("| 路线编号 | 起止桩号 | 病害等级 | 长度(km) | 优先级 | 预估费用(元) | 分配资金(元) | 资助比例 | 状态 |\n")
	sb.WriteString("|----------|----------|----------|---------|--------|-------------|-------------|--------|------|\n")

	for _, alloc := range budgetPlan.Allocations {
		stationRange := fmt.Sprintf("%s ~ %s", alloc.StartStation, alloc.EndStation)
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %.3f | %.2f | %.2f | %.2f | %.2f%% | %s |\n",
			alloc.RouteID, stationRange, alloc.DiseaseGrade,
			alloc.SectionLength, alloc.PriorityScore,
			alloc.EstimatedCost, alloc.AllocatedFund,
			alloc.FundingRatio, alloc.FundingStatus))
	}
	sb.WriteString("\n")

	sb.WriteString("---\n\n")
}

func (rg *ReportGenerator) writeSummary(
	sb *strings.Builder,
	records []*storage.PavementRecord,
	budgetPlan *engine.BudgetPlan,
) {

	sb.WriteString("## 四、结论与建议\n\n")

	totalCount := len(records)
	poorCount := 0
	poorMileage := 0.0
	for _, r := range records {
		if r.DiseaseGrade == "差" || r.DiseaseGrade == "中" {
			poorCount++
			poorMileage += r.SectionLength
		}
	}

	poorRatio := safePercent(float64(poorCount), float64(totalCount))

	sb.WriteString(fmt.Sprintf("> **关键发现**:\n\n"))
	sb.WriteString(fmt.Sprintf("- 需紧急或较差路段占比 **%.2f%%** (%d 段 / %.2f km)，建议列入年度重点养护计划。\n",
		poorRatio, poorCount, poorMileage))

	if budgetPlan != nil {
		urgentCost := 0.0
		for _, alloc := range budgetPlan.Allocations {
			if alloc.DiseaseGrade == "差" {
				urgentCost += alloc.AllocatedFund
			}
		}
		sb.WriteString(fmt.Sprintf("- 紧急养护路段已分配资金 **¥%.2f 元**，占总分配的 %.2f%%。\n",
			urgentCost,
			safePercent(urgentCost, budgetPlan.AllocatedBudget)))

		if budgetPlan.UnfundedCount > 0 {
			sb.WriteString(fmt.Sprintf("- **%d** 条路段因预算限制无法安排养护，建议争取追加预算或纳入下一年度计划。\n",
				budgetPlan.UnfundedCount))
		}
	}

	sb.WriteString("\n")
	sb.WriteString("**编制建议**:\n\n")
	sb.WriteString("1. 优先安排病害等级为\"差\"的路段进行铣刨重铺等结构性修复\n")
	sb.WriteString("2. 对交通量大的国道路段优先保障资金倾斜\n")
	sb.WriteString("3. 建议每季度开展一次全面检测，更新养护优先级\n")
	sb.WriteString("4. 建立养护效果跟踪，对比养护前后路况改善情况\n")

	sb.WriteString("\n---\n\n")
	sb.WriteString("*本报告由 pavement CLI 自动生成*\n")
}

func calculateAverageScore(records []*storage.PavementRecord) float64 {
	if len(records) == 0 {
		return 0
	}
	sum := 0.0
	for _, r := range records {
		sum += r.TotalScore
	}
	return sum / float64(len(records))
}

func safePercent(part, total float64) float64 {
	if total <= 0 {
		return 0
	}
	return (part / total) * 100
}

func (rg *ReportGenerator) GenerateImportReport(
	result map[string]interface{},
	outputPath string,
) (string, error) {
	return "", nil
}

func (rg *ReportGenerator) GenerateStatisticsReport(
	statsByRoute, statsByCenter, statsByGrade []*storage.StatisticsResult,
	outputPath string,
) (string, error) {

	var sb strings.Builder

	ctx := &ReportContext{
		Title:        "路面病害统计报告",
		GeneratedAt: time.Now(),
		GeneratedBy: "pavement CLI",
		StandardName: rg.classifier.GetStandardName(),
	}

	rg.writeHeader(&sb, ctx)

	sb.WriteString("## 数据统计报表\n\n")

	sb.WriteString("### 按路线维度统计\n\n")
	if len(statsByRoute) > 0 {
		sb.WriteString("| 路线编号 | 路段数 | 里程(km) | 里程占比 | 优 | 良 | 中 | 差 |\n")
		sb.WriteString("|----------|--------|---------|----------|-----|-----|-----|-----|\n")
		for _, s := range statsByRoute {
			sb.WriteString(fmt.Sprintf("| %s | %d | %.2f | %.2f%% | %d | %d | %d | %d |\n",
				s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio,
				s.Excellent, s.Good, s.Medium, s.Poor))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("### 按养护中心维度统计\n\n")
	if len(statsByCenter) > 0 {
		sb.WriteString("| 养护中心 | 路段数 | 里程(km) | 里程占比 | 优 | 良 | 中 | 差 |\n")
		sb.WriteString("|----------|--------|---------|----------|-----|-----|-----|-----|\n")
		for _, s := range statsByCenter {
			sb.WriteString(fmt.Sprintf("| %s | %d | %.2f | %.2f%% | %d | %d | %d | %d |\n",
				s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio,
				s.Excellent, s.Good, s.Medium, s.Poor))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("### 按病害等级维度统计\n\n")
	if len(statsByGrade) > 0 {
		sb.WriteString("| 病害等级 | 路段数 | 里程(km) | 里程占比 |\n")
		sb.WriteString("|----------|--------|---------|----------|\n")
		for _, s := range statsByGrade {
			sb.WriteString(fmt.Sprintf("| %s | %d | %.2f | %.2f%% |\n",
				s.Value, s.SectionCount, s.TotalMileage, s.MileageRatio))
		}
		sb.WriteString("\n")
	}

	content := sb.String()

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if dir != "." {
			os.MkdirAll(dir, 0755)
		}
		if err := os.WriteFile(outputPath, []byte(content), 0644); err != nil {
			return "", pverrors.NewExportError(
				pverrors.ErrExportWriteFailed,
				"写入统计报告失败",
				"请检查输出路径和权限",
				err,
			)
		}
		return outputPath, nil
	}

	tmpFile := filepath.Join(os.TempDir(),
		fmt.Sprintf("statistics_report_%s.md", time.Now().Format("20060102_150405")))
	os.WriteFile(tmpFile, []byte(content), 0644)
	return tmpFile, nil
}

func SortByKey(data []*storage.StatisticsResult, key string) {
	sort.Slice(data, func(i, j int) bool {
		return data[i].TotalMileage > data[j].TotalMileage
	})
}

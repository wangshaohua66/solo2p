package report

import (
	"encoding/csv"
	"fmt"
	"os"
	"time"

	"eco-inspector/internal/database"
	"eco-inspector/pkg/logger"
)

type ProgressSummary struct {
	Total        int `json:"total"`
	Pending      int `json:"pending"`
	InProgress   int `json:"in_progress"`
	Review       int `json:"review"`
	Closed       int `json:"closed"`
	Overdue      int `json:"overdue"`
	CloseRate    float64 `json:"close_rate"`
}

type RegionStats struct {
	Region     string  `json:"region"`
	Total      int     `json:"total"`
	Closed     int     `json:"closed"`
	CloseRate  float64 `json:"close_rate"`
	Overdue   int     `json:"overdue"`
}

type IndustryStats struct {
	Industry   string  `json:"industry"`
	Total      int     `json:"total"`
	Closed     int     `json:"closed"`
	CloseRate  float64 `json:"close_rate"`
}

type ProblemTypeStats struct {
	ProblemType string  `json:"problem_type"`
	Total       int     `json:"total"`
	Closed      int     `json:"closed"`
	CloseRate   float64 `json:"close_rate"`
}

type OverdueEnterprise struct {
	EnterpriseName string `json:"enterprise_name"`
	EnterpriseID   string `json:"enterprise_id"`
	OverdueCount   int    `json:"overdue_count"`
	MaxOverdueDays int    `json:"max_overdue_days"`
	RiskLevel     string `json:"risk_level"`
}

type WeeklyReport struct {
	Period       string            `json:"period"`
	Summary      ProgressSummary   `json:"summary"`
	ByRegion     []RegionStats     `json:"by_region"`
	ByIndustry   []IndustryStats   `json:"by_industry"`
	ByProblemType []ProblemTypeStats `json:"by_problem_type"`
	OverdueList  []OverdueEnterprise `json:"overdue_list"`
}

type Generator struct{}

func NewGenerator() *Generator {
	return &Generator{}
}

func (g *Generator) GetProgressSummary(startDate, endDate string) (*ProgressSummary, error) {
	summary := &ProgressSummary{}

	query := `SELECT status, COUNT(*) FROM rectifications`
	var args []interface{}

	if startDate != "" && endDate != "" {
		query += ` WHERE created_at >= ? AND created_at <= ?`
		args = append(args, startDate, endDate)
	}
	query += ` GROUP BY status`

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("查询进度汇总失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			continue
		}
		summary.Total += count
		switch status {
		case "待整改":
			summary.Pending = count
		case "整改中":
			summary.InProgress = count
		case "待验收":
			summary.Review = count
		case "已销号":
			summary.Closed = count
		}
	}

	now := time.Now().Format("2006-01-02")
	var overdueCount int
	err = database.DB.QueryRow(`
		SELECT COUNT(*) FROM rectifications
		WHERE status IN ('待整改', '整改中') AND deadline < ?`, now).Scan(&overdueCount)
	if err == nil {
		summary.Overdue = overdueCount
	}

	if summary.Total > 0 {
		summary.CloseRate = float64(summary.Closed) / float64(summary.Total) * 100
	}

	return summary, nil
}

func (g *Generator) GetRegionStats() ([]RegionStats, error) {
	rows, err := database.DB.Query(`
		SELECT e.region,
			COUNT(*) as total,
			SUM(CASE WHEN r.status = '已销号' THEN 1 ELSE 0 END) as closed,
			SUM(CASE WHEN r.status IN ('待整改', '整改中') AND r.deadline < date('now') THEN 1 ELSE 0 END) as overdue
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		GROUP BY e.region
		ORDER BY total DESC`)
	if err != nil {
		return nil, fmt.Errorf("查询区域统计失败: %w", err)
	}
	defer rows.Close()

	var stats []RegionStats
	for rows.Next() {
		var s RegionStats
		if err := rows.Scan(&s.Region, &s.Total, &s.Closed, &s.Overdue); err != nil {
			continue
		}
		if s.Total > 0 {
			s.CloseRate = float64(s.Closed) / float64(s.Total) * 100
		}
		stats = append(stats, s)
	}

	if stats == nil {
		stats = []RegionStats{}
	}
	return stats, nil
}

func (g *Generator) GetIndustryStats() ([]IndustryStats, error) {
	rows, err := database.DB.Query(`
		SELECT e.industry,
			COUNT(*) as total,
			SUM(CASE WHEN r.status = '已销号' THEN 1 ELSE 0 END) as closed
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		GROUP BY e.industry
		ORDER BY total DESC`)
	if err != nil {
		return nil, fmt.Errorf("查询行业统计失败: %w", err)
	}
	defer rows.Close()

	var stats []IndustryStats
	for rows.Next() {
		var s IndustryStats
		if err := rows.Scan(&s.Industry, &s.Total, &s.Closed); err != nil {
			continue
		}
		if s.Total > 0 {
			s.CloseRate = float64(s.Closed) / float64(s.Total) * 100
		}
		stats = append(stats, s)
	}

	if stats == nil {
		stats = []IndustryStats{}
	}
	return stats, nil
}

func (g *Generator) GetProblemTypeStats() ([]ProblemTypeStats, error) {
	rows, err := database.DB.Query(`
		SELECT problem_type,
			COUNT(*) as total,
			SUM(CASE WHEN status = '已销号' THEN 1 ELSE 0 END) as closed
		FROM rectifications
		GROUP BY problem_type
		ORDER BY total DESC`)
	if err != nil {
		return nil, fmt.Errorf("查询问题类型统计失败: %w", err)
	}
	defer rows.Close()

	var stats []ProblemTypeStats
	for rows.Next() {
		var s ProblemTypeStats
		if err := rows.Scan(&s.ProblemType, &s.Total, &s.Closed); err != nil {
			continue
		}
		if s.Total > 0 {
			s.CloseRate = float64(s.Closed) / float64(s.Total) * 100
		}
		stats = append(stats, s)
	}

	if stats == nil {
		stats = []ProblemTypeStats{}
	}
	return stats, nil
}

func (g *Generator) GetOverdueEnterprises() ([]OverdueEnterprise, error) {
	rows, err := database.DB.Query(`
		SELECT e.id, e.name, e.risk_level,
			COUNT(*) as overdue_count,
			MAX(julianday('now') - julianday(r.deadline)) as max_overdue_days
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		WHERE r.status IN ('待整改', '整改中') AND r.deadline < date('now')
		GROUP BY e.id
		ORDER BY max_overdue_days DESC`)
	if err != nil {
		return nil, fmt.Errorf("查询超期企业失败: %w", err)
	}
	defer rows.Close()

	var items []OverdueEnterprise
	for rows.Next() {
		var item OverdueEnterprise
		if err := rows.Scan(&item.EnterpriseID, &item.EnterpriseName, &item.RiskLevel, &item.OverdueCount, &item.MaxOverdueDays); err != nil {
			continue
		}
		items = append(items, item)
	}

	if items == nil {
		items = []OverdueEnterprise{}
	}
	return items, nil
}

func (g *Generator) GenerateWeeklyReport() (*WeeklyReport, error) {
	now := time.Now()
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekEnd := now

	report := &WeeklyReport{
		Period: fmt.Sprintf("%s ~ %s", weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02")),
	}

	summary, err := g.GetProgressSummary(weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02 23:59:59"))
	if err != nil {
		return nil, err
	}
	report.Summary = *summary

	regions, err := g.GetRegionStats()
	if err != nil {
		return nil, err
	}
	report.ByRegion = regions

	industries, err := g.GetIndustryStats()
	if err != nil {
		return nil, err
	}
	report.ByIndustry = industries

	problemTypes, err := g.GetProblemTypeStats()
	if err != nil {
		return nil, err
	}
	report.ByProblemType = problemTypes

	overdueList, err := g.GetOverdueEnterprises()
	if err != nil {
		return nil, err
	}
	report.OverdueList = overdueList

	logger.LogAction("system", "生成周报", "", "成功")
	return report, nil
}

func (g *Generator) GenerateMonthlyReport() (*WeeklyReport, error) {
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	report := &WeeklyReport{
		Period: fmt.Sprintf("%s ~ %s", monthStart.Format("2006-01-02"), now.Format("2006-01-02")),
	}

	summary, err := g.GetProgressSummary(monthStart.Format("2006-01-02"), now.Format("2006-01-02 23:59:59"))
	if err != nil {
		return nil, err
	}
	report.Summary = *summary

	regions, err := g.GetRegionStats()
	if err != nil {
		return nil, err
	}
	report.ByRegion = regions

	industries, err := g.GetIndustryStats()
	if err != nil {
		return nil, err
	}
	report.ByIndustry = industries

	problemTypes, err := g.GetProblemTypeStats()
	if err != nil {
		return nil, err
	}
	report.ByProblemType = problemTypes

	overdueList, err := g.GetOverdueEnterprises()
	if err != nil {
		return nil, err
	}
	report.OverdueList = overdueList

	logger.LogAction("system", "生成月报", "", "成功")
	return report, nil
}

func (g *Generator) ExportReportCSV(filePath string, report *WeeklyReport) error {
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	defer writer.Flush()

	fmt.Fprintf(f, "整改进度报告 - %s\n\n", report.Period)
	fmt.Fprintf(f, "总览\n")
	fmt.Fprintf(f, "总事项数,待整改,整改中,待验收,已销号,超期,销号率\n")
	fmt.Fprintf(f, "%d,%d,%d,%d,%d,%d,%.1f%%\n\n",
		report.Summary.Total, report.Summary.Pending, report.Summary.InProgress,
		report.Summary.Review, report.Summary.Closed, report.Summary.Overdue, report.Summary.CloseRate)

	fmt.Fprintf(f, "按区域统计\n")
	writer.Write([]string{"区域", "总事项", "已销号", "销号率", "超期数"})
	for _, r := range report.ByRegion {
		writer.Write([]string{r.Region, fmt.Sprintf("%d", r.Total), fmt.Sprintf("%d", r.Closed), fmt.Sprintf("%.1f%%", r.CloseRate), fmt.Sprintf("%d", r.Overdue)})
	}
	writer.Flush()

	fmt.Fprintf(f, "\n按行业统计\n")
	writer.Write([]string{"行业", "总事项", "已销号", "销号率"})
	for _, r := range report.ByIndustry {
		writer.Write([]string{r.Industry, fmt.Sprintf("%d", r.Total), fmt.Sprintf("%d", r.Closed), fmt.Sprintf("%.1f%%", r.CloseRate)})
	}
	writer.Flush()

	fmt.Fprintf(f, "\n超期未整改企业清单\n")
	writer.Write([]string{"企业名称", "超期事项数", "最长超期天数", "风险等级"})
	for _, o := range report.OverdueList {
		writer.Write([]string{o.EnterpriseName, fmt.Sprintf("%d", o.OverdueCount), fmt.Sprintf("%d", o.MaxOverdueDays), o.RiskLevel})
	}
	writer.Flush()

	logger.LogAction("system", "导出报表", filePath, "成功")
	return nil
}

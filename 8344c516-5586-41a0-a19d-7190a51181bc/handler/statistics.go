package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"exam-system/model"
	_ "exam-system/middleware"
)

func GetStatisticsOverview(c *gin.Context) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := todayStart.AddDate(0, 0, 1)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := monthStart.AddDate(0, 1, 0)

	var todayExamCount int64
	model.DB.Model(&model.Exam{}).Where("exam_date >= ? AND exam_date < ?", todayStart, todayEnd).Count(&todayExamCount)

	var monthCandidateCount int64
	model.DB.Table("biz_exam_apply").
		Where("apply_time >= ? AND apply_time < ?", monthStart, monthEnd).
		Count(&monthCandidateCount)

	var pendingExamCount int64
	model.DB.Model(&model.Exam{}).Where("status = ?", 0).Count(&pendingExamCount)

	var warnings []map[string]interface{}

	var expiredQualifications []map[string]interface{}
	model.DB.Table("biz_examiner_qualification").
		Select("biz_examiner_qualification.id, sys_user.real_name as examiner_name, sys_trade.name as trade_name, expiry_date").
		Joins("JOIN sys_user ON biz_examiner_qualification.examiner_id = sys_user.id").
		Joins("JOIN sys_trade ON biz_examiner_qualification.trade_id = sys_trade.id").
		Where("expiry_date < ?", now.AddDate(0, 1, 0)).
		Scan(&expiredQualifications)

	for _, q := range expiredQualifications {
		warnings = append(warnings, map[string]interface{}{
			"type":    "qualification",
			"level":   "warning",
			"message": fmt.Sprintf("考评员[%s]的[%s]资质即将到期", q["examiner_name"], q["trade_name"]),
			"date":    q["expiry_date"],
		})
	}

	var lowPassExams []map[string]interface{}
	model.DB.Table("biz_exam").
		Select("biz_exam.id, biz_exam.name, biz_exam.exam_date, COUNT(biz_score.id) as total, SUM(CASE WHEN biz_score.pass_status = 1 THEN 1 ELSE 0 END) as passed").
		Joins("LEFT JOIN biz_score ON biz_exam.id = biz_score.exam_id").
		Where("biz_exam.status = ?", 3).
		Group("biz_exam.id, biz_exam.name, biz_exam.exam_date").
		Having("COUNT(biz_score.id) > 0 AND (SUM(CASE WHEN biz_score.pass_status = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(biz_score.id)) < 0.6").
		Scan(&lowPassExams)

	for _, e := range lowPassExams {
		total, _ := e["total"].(int64)
		passed, _ := e["passed"].(int64)
		if total > 0 {
			rate := float64(passed) / float64(total) * 100
			warnings = append(warnings, map[string]interface{}{
				"type":    "pass_rate",
				"level":   "warning",
				"message": fmt.Sprintf("考期[%s]通过率过低：%.2f%%", e["name"], rate),
				"date":    e["exam_date"],
			})
		}
	}

	Success(c, gin.H{
		"todayExamCount":      todayExamCount,
		"monthCandidateCount": monthCandidateCount,
		"pendingExamCount":    pendingExamCount,
		"warnings":            warnings,
	})
}

func GetMonthlyStatistics(c *gin.Context) {
	type MonthlyData struct {
		Month             string  `json:"month"`
		ApplyCount        int64   `json:"applyCount"`
		AttendCount       int64   `json:"attendCount"`
		PassCount         int64   `json:"passCount"`
		ExamCount         int64   `json:"examCount"`
		AttendRate        float64 `json:"attendRate"`
		PassRate          float64 `json:"passRate"`
		UtilizationRate   float64 `json:"utilizationRate"`
		ExaminerWorkload  float64 `json:"examinerWorkload"`
	}

	now := time.Now()
	var results []MonthlyData

	for i := 11; i >= 0; i-- {
		month := now.AddDate(0, -i, 0)
		monthStart := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, now.Location())
		monthEnd := monthStart.AddDate(0, 1, 0)
		monthStr := monthStart.Format("2006-01")

		var applyCount int64
		model.DB.Table("biz_exam_apply").
			Where("apply_time >= ? AND apply_time < ?", monthStart, monthEnd).
			Count(&applyCount)

		var attendCount int64
		model.DB.Table("biz_score").
			Where("created_at >= ? AND created_at < ? AND total_score IS NOT NULL", monthStart, monthEnd).
			Count(&attendCount)

		var passCount int64
		model.DB.Table("biz_score").
			Where("created_at >= ? AND created_at < ? AND pass_status = 1", monthStart, monthEnd).
			Count(&passCount)

		var examCount int64
		model.DB.Table("biz_exam").
			Where("exam_date >= ? AND exam_date < ?", monthStart, monthEnd).
			Count(&examCount)

		var totalSeats int64
		model.DB.Table("biz_exam").
			Where("exam_date >= ? AND exam_date < ?", monthStart, monthEnd).
			Select("COALESCE(SUM(total_seats), 0)").Scan(&totalSeats)

		var examinerAssignCount int64
		model.DB.Table("biz_examiner_assign").
			Joins("JOIN biz_schedule ON biz_examiner_assign.schedule_id = biz_schedule.id").
			Where("biz_schedule.schedule_date >= ? AND biz_schedule.schedule_date < ?", monthStart, monthEnd).
			Count(&examinerAssignCount)

		attendRate := 0.0
		if applyCount > 0 {
			attendRate = float64(attendCount) / float64(applyCount) * 100
		}

		passRate := 0.0
		if attendCount > 0 {
			passRate = float64(passCount) / float64(attendCount) * 100
		}

		utilizationRate := 0.0
		if totalSeats > 0 {
			utilizationRate = float64(attendCount) / float64(totalSeats) * 100
		}

		examinerWorkload := 0.0
		if examCount > 0 {
			examinerWorkload = float64(examinerAssignCount) / float64(examCount)
		}

		results = append(results, MonthlyData{
			Month:            monthStr,
			ApplyCount:       applyCount,
			AttendCount:      attendCount,
			PassCount:        passCount,
			ExamCount:        examCount,
			AttendRate:       attendRate,
			PassRate:         passRate,
			UtilizationRate:  utilizationRate,
			ExaminerWorkload: examinerWorkload,
		})
	}

	Success(c, results)
}

func GetTradeStatistics(c *gin.Context) {
	type TradeData struct {
		TradeID     uint    `json:"tradeId"`
		TradeName   string  `json:"tradeName"`
		Level       string  `json:"level"`
		ApplyCount  int64   `json:"applyCount"`
		PassCount   int64   `json:"passCount"`
		PassRate    float64 `json:"passRate"`
	}

	var results []TradeData

	model.DB.Table("sys_trade").
		Select("sys_trade.id as trade_id, sys_trade.name as trade_name, sys_trade.level, "+
			"COUNT(biz_exam_apply.id) as apply_count, "+
			"SUM(CASE WHEN biz_score.pass_status = 1 THEN 1 ELSE 0 END) as pass_count").
		Joins("LEFT JOIN biz_exam_apply ON sys_trade.id = biz_exam_apply.trade_id").
		Joins("LEFT JOIN biz_score ON biz_exam_apply.id = biz_score.exam_apply_id").
		Where("sys_trade.parent_id IS NOT NULL").
		Group("sys_trade.id, sys_trade.name, sys_trade.level").
		Scan(&results)

	for i := range results {
		if results[i].ApplyCount > 0 {
			results[i].PassRate = float64(results[i].PassCount) / float64(results[i].ApplyCount) * 100
		}
	}

	Success(c, results)
}

func GetInstitutionStatistics(c *gin.Context) {
	type InstitutionData struct {
		InstitutionID uint    `json:"institutionId"`
		InstitutionName string `json:"institutionName"`
		ExamCount     int64   `json:"examCount"`
		ApplyCount    int64   `json:"applyCount"`
		PassCount     int64   `json:"passCount"`
		PassRate      float64 `json:"passRate"`
	}

	var results []InstitutionData

	model.DB.Table("sys_institution").
		Select("sys_institution.id as institution_id, sys_institution.name as institution_name, "+
			"COUNT(DISTINCT biz_exam.id) as exam_count, "+
			"COUNT(biz_exam_apply.id) as apply_count, "+
			"SUM(CASE WHEN biz_score.pass_status = 1 THEN 1 ELSE 0 END) as pass_count").
		Joins("LEFT JOIN biz_exam ON sys_institution.id = biz_exam.institution_id").
		Joins("LEFT JOIN biz_exam_apply ON biz_exam.id = biz_exam_apply.exam_id").
		Joins("LEFT JOIN biz_score ON biz_exam_apply.id = biz_score.exam_apply_id").
		Group("sys_institution.id, sys_institution.name").
		Scan(&results)

	for i := range results {
		if results[i].ApplyCount > 0 {
			results[i].PassRate = float64(results[i].PassCount) / float64(results[i].ApplyCount) * 100
		}
	}

	Success(c, results)
}

func ExportStatistics(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	now := time.Now()
	if startDate == "" {
		startDate = now.AddDate(0, -1, 0).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = now.Format("2006-01-02")
	}

	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)
	end = end.AddDate(0, 0, 1)

	f := excelize.NewFile()

	sheet1 := "月度统计"
	f.SetSheetName("Sheet1", sheet1)

	headers1 := []string{"月份", "报名人数", "参考人数", "通过人数", "参考率(%)", "通过率(%)", "考场利用率(%)", "考评员人均工作量"}
	for i, header := range headers1 {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheet1, cell, header)
	}

	row := 2
	monthStart := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, now.Location())
	for !monthStart.After(end) {
		monthEnd := monthStart.AddDate(0, 1, 0)
		monthStr := monthStart.Format("2006-01")

		var applyCount int64
		model.DB.Table("biz_exam_apply").
			Where("apply_time >= ? AND apply_time < ?", monthStart, monthEnd).
			Count(&applyCount)

		var attendCount int64
		model.DB.Table("biz_score").
			Where("created_at >= ? AND created_at < ? AND total_score IS NOT NULL", monthStart, monthEnd).
			Count(&attendCount)

		var passCount int64
		model.DB.Table("biz_score").
			Where("created_at >= ? AND created_at < ? AND pass_status = 1", monthStart, monthEnd).
			Count(&passCount)

		var totalSeats int64
		model.DB.Table("biz_exam").
			Where("exam_date >= ? AND exam_date < ?", monthStart, monthEnd).
			Select("COALESCE(SUM(total_seats), 0)").Scan(&totalSeats)

		var examCount int64
		model.DB.Table("biz_exam").
			Where("exam_date >= ? AND exam_date < ?", monthStart, monthEnd).
			Count(&examCount)

		var examinerAssignCount int64
		model.DB.Table("biz_examiner_assign").
			Joins("JOIN biz_schedule ON biz_examiner_assign.schedule_id = biz_schedule.id").
			Where("biz_schedule.schedule_date >= ? AND biz_schedule.schedule_date < ?", monthStart, monthEnd).
			Count(&examinerAssignCount)

		attendRate := 0.0
		if applyCount > 0 {
			attendRate = float64(attendCount) / float64(applyCount) * 100
		}

		passRate := 0.0
		if attendCount > 0 {
			passRate = float64(passCount) / float64(attendCount) * 100
		}

		utilizationRate := 0.0
		if totalSeats > 0 {
			utilizationRate = float64(attendCount) / float64(totalSeats) * 100
		}

		examinerWorkload := 0.0
		if examCount > 0 {
			examinerWorkload = float64(examinerAssignCount) / float64(examCount)
		}

		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), monthStr)
		f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), applyCount)
		f.SetCellValue(sheet1, fmt.Sprintf("C%d", row), attendCount)
		f.SetCellValue(sheet1, fmt.Sprintf("D%d", row), passCount)
		f.SetCellValue(sheet1, fmt.Sprintf("E%d", row), fmt.Sprintf("%.2f", attendRate))
		f.SetCellValue(sheet1, fmt.Sprintf("F%d", row), fmt.Sprintf("%.2f", passRate))
		f.SetCellValue(sheet1, fmt.Sprintf("G%d", row), fmt.Sprintf("%.2f", utilizationRate))
		f.SetCellValue(sheet1, fmt.Sprintf("H%d", row), fmt.Sprintf("%.2f", examinerWorkload))

		monthStart = monthStart.AddDate(0, 1, 0)
		row++
	}

	sheet2 := "工种统计"
	f.NewSheet(sheet2)

	headers2 := []string{"工种", "等级", "报名人数", "通过人数", "通过率(%)"}
	for i, header := range headers2 {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheet2, cell, header)
	}

	type TradeExport struct {
		TradeName  string
		Level      string
		ApplyCount int64
		PassCount  int64
	}

	var tradeResults []TradeExport
	model.DB.Table("sys_trade").
		Select("sys_trade.name as trade_name, sys_trade.level, "+
			"COUNT(biz_exam_apply.id) as apply_count, "+
			"SUM(CASE WHEN biz_score.pass_status = 1 THEN 1 ELSE 0 END) as pass_count").
		Joins("LEFT JOIN biz_exam_apply ON sys_trade.id = biz_exam_apply.trade_id").
		Joins("LEFT JOIN biz_score ON biz_exam_apply.id = biz_score.exam_apply_id").
		Where("biz_exam_apply.apply_time >= ? AND biz_exam_apply.apply_time < ?", start, end).
		Where("sys_trade.parent_id IS NOT NULL").
		Group("sys_trade.id, sys_trade.name, sys_trade.level").
		Scan(&tradeResults)

	row = 2
	for _, t := range tradeResults {
		passRate := 0.0
		if t.ApplyCount > 0 {
			passRate = float64(t.PassCount) / float64(t.ApplyCount) * 100
		}
		f.SetCellValue(sheet2, fmt.Sprintf("A%d", row), t.TradeName)
		f.SetCellValue(sheet2, fmt.Sprintf("B%d", row), t.Level)
		f.SetCellValue(sheet2, fmt.Sprintf("C%d", row), t.ApplyCount)
		f.SetCellValue(sheet2, fmt.Sprintf("D%d", row), t.PassCount)
		f.SetCellValue(sheet2, fmt.Sprintf("E%d", row), fmt.Sprintf("%.2f", passRate))
		row++
	}

	sheet3 := "机构统计"
	f.NewSheet(sheet3)

	headers3 := []string{"机构名称", "考期数", "报名人数", "通过人数", "通过率(%)"}
	for i, header := range headers3 {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheet3, cell, header)
	}

	type InstitutionExport struct {
		InstitutionName string
		ExamCount       int64
		ApplyCount      int64
		PassCount       int64
	}

	var instResults []InstitutionExport
	model.DB.Table("sys_institution").
		Select("sys_institution.name as institution_name, "+
			"COUNT(DISTINCT biz_exam.id) as exam_count, "+
			"COUNT(biz_exam_apply.id) as apply_count, "+
			"SUM(CASE WHEN biz_score.pass_status = 1 THEN 1 ELSE 0 END) as pass_count").
		Joins("LEFT JOIN biz_exam ON sys_institution.id = biz_exam.institution_id").
		Joins("LEFT JOIN biz_exam_apply ON biz_exam.id = biz_exam_apply.exam_id").
		Joins("LEFT JOIN biz_score ON biz_exam_apply.id = biz_score.exam_apply_id").
		Where("biz_exam_apply.apply_time >= ? AND biz_exam_apply.apply_time < ?", start, end).
		Group("sys_institution.id, sys_institution.name").
		Scan(&instResults)

	row = 2
	for _, inst := range instResults {
		passRate := 0.0
		if inst.ApplyCount > 0 {
			passRate = float64(inst.PassCount) / float64(inst.ApplyCount) * 100
		}
		f.SetCellValue(sheet3, fmt.Sprintf("A%d", row), inst.InstitutionName)
		f.SetCellValue(sheet3, fmt.Sprintf("B%d", row), inst.ExamCount)
		f.SetCellValue(sheet3, fmt.Sprintf("C%d", row), inst.ApplyCount)
		f.SetCellValue(sheet3, fmt.Sprintf("D%d", row), inst.PassCount)
		f.SetCellValue(sheet3, fmt.Sprintf("E%d", row), fmt.Sprintf("%.2f", passRate))
		row++
	}

	filename := fmt.Sprintf("统计报表_%s_%s.xlsx", startDate, endDate)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("File-Name", filename)

	if err := f.Write(c.Writer); err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}
}

package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"exam-system/model"
	_ "exam-system/middleware"
)

type CreateExamRequest struct {
	InstitutionID uint      `json:"institutionId" binding:"required"`
	TradeID       uint      `json:"tradeId" binding:"required"`
	Level         string    `json:"level" binding:"required"`
	LevelCode     string    `json:"levelCode" binding:"required"`
	ExamType      string    `json:"examType" binding:"required"`
	CandidateNum   int       `json:"candidateNum" binding:"required,min=1"`
	ExpectedStart time.Time `json:"expectedStart" binding:"required"`
	ExpectedEnd   time.Time `json:"expectedEnd" binding:"required"`
	Remark        string    `json:"remark"`
}

type ApproveExamRequest struct {
	Approved bool   `json:"approved" binding:"required"`
	Remark   string `json:"remark"`
}

type ConflictInfo struct {
	Type        string      `json:"type"`
	Description string      `json:"description"`
	Detail      interface{} `json:"detail"`
}

type ConflictResponse struct {
	HasConflicts bool           `json:"hasConflicts"`
	Conflicts     []ConflictInfo `json:"conflicts"`
	Suggestions   []string     `json:"suggestions"`
}

type CalendarEvent struct {
	ID     uint   `json:"id"`
	Title  string `json:"title"`
	Start  string `json:"start"`
	End    string `json:"end"`
	Color  string `json:"color"`
	Status string `json:"status"`
}

func GetExamList(c *gin.Context) {
	page, pageSize := GetPageParams(c)

	userRole := GetUserRole(c)
	userID := GetUserID(c)

	institutionID := c.Query("institutionId")
	tradeID := c.Query("tradeId")
	status := c.Query("status")

	query := model.DB.Model(&model.Exam{}).Preload("Institution").Preload("Trade")

	if userRole != RoleAdmin {
		var user model.User
		err := model.DB.Where("id = ?", userID).First(&user).Error
		if err == nil && user.InstitutionID != nil {
			query = query.Where("institution_id = ?", *user.InstitutionID)
		}
	}

	if institutionID != "" {
		query = query.Where("institution_id = ?", institutionID)
	}

	if tradeID != "" {
		query = query.Where("trade_id = ?", tradeID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var exams []model.Exam
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&exams).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	PageSuccess(c, exams, total, page, pageSize)
}

func CreateExam(c *gin.Context) {
	var req CreateExamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	conflicts := checkExamConflicts(0, req.InstitutionID, req.ExpectedStart, req.ExpectedEnd)
	if len(conflicts) > 0 {
		Error(c, http.StatusBadRequest, "存在冲突，请检查后重新提交")
		return
	}

	var trade model.Trade
	if err := model.DB.Where("id = ?", req.TradeID).First(&trade).Error; err != nil {
		Error(c, http.StatusBadRequest, "工种不存在")
		return
	}

	exam := model.Exam{
		Name:          fmt.Sprintf("%s-%s考试", trade.Name, req.Level),
		TradeID:       req.TradeID,
		Level:         req.Level,
		LevelCode:     req.LevelCode,
		InstitutionID: req.InstitutionID,
		ExamType:      req.ExamType,
		ExamDate:      req.ExpectedStart,
		StartTime:     req.ExpectedStart.Format("15:04"),
		EndTime:       req.ExpectedEnd.Format("15:04"),
		Duration:      int(req.ExpectedEnd.Sub(req.ExpectedStart).Minutes()),
		TotalSeats:    req.CandidateNum,
		Status:        0,
		Remark:        req.Remark,
	}

	if err := model.DB.Create(&exam).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, exam)
}

func GetExamDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var exam model.Exam
	if err := model.DB.Preload("Institution").Preload("Trade").
		Where("id = ?", id).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	var schedules []model.Schedule
	model.DB.Where("exam_id = ?", id).Preload("Workstation").Find(&schedules)

	var examinerAssigns []model.ExaminerAssign
	model.DB.Where("exam_id = ?", id).Preload("Examiner").Preload("Schedule").Find(&examinerAssigns)

	var applies []model.ExamApply
	model.DB.Where("exam_id = ?", id).Preload("User").Preload("Trade").Find(&applies)

	result := gin.H{
		"exam":      exam,
		"schedules":   schedules,
		"examiners":  examinerAssigns,
		"applications": applies,
	}

	Success(c, result)
}

func UpdateExam(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var exam model.Exam
	if err := model.DB.Where("id = ?", id).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	if err := c.ShouldBindJSON(&exam); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := model.DB.Save(&exam).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, exam)
}

func CheckConflicts(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var exam model.Exam
	if err := model.DB.Where("id = ?", id).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	conflicts := checkExamConflicts(uint(id), exam.InstitutionID, exam.ExamDate, exam.ExamDate.Add(time.Duration(exam.Duration)*time.Minute))

	suggestions := generateSuggestions(exam)

	response := ConflictResponse{
		HasConflicts: len(conflicts) > 0,
		Conflicts:     conflicts,
		Suggestions:   suggestions,
	}

	Success(c, response)
}

func GetCalendarData(c *gin.Context) {
	startDate := c.Query("start")
	endDate := c.Query("end")

	query := model.DB.Model(&model.Exam{}).Preload("Institution").Preload("Trade")

	if startDate != "" && endDate != "" {
		start, _ := time.Parse("2006-01-02", startDate)
		end, _ := time.Parse("2006-01-02", endDate)
		query = query.Where("exam_date BETWEEN ? AND ?", start, end)
	}

	var exams []model.Exam
	if err := query.Find(&exams).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var events []CalendarEvent
	for _, exam := range exams {
		color := "#3b82f6"
		statusText := "待审批"
		switch exam.Status {
		case 1:
			color = "#22c55e"
			statusText = "已通过"
		case 2:
			color = "#eab308"
			statusText = "已发布"
		case 3:
			color = "#6b7280"
			statusText = "已完成"
		case -1:
			color = "#ef4444"
			statusText = "已驳回"
		}

		events = append(events, CalendarEvent{
			ID:     exam.ID,
			Title:  exam.Name,
			Start:  exam.ExamDate.Format("2006-01-02T15:04:05"),
			End:    exam.ExamDate.Add(time.Duration(exam.Duration) * time.Minute).Format("2006-01-02T15:04:05"),
			Color:  color,
			Status: statusText,
		})
	}

	Success(c, events)
}

func ApproveExam(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var req ApproveExamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	var exam model.Exam
	if err := model.DB.Where("id = ?", id).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	if req.Approved {
		exam.Status = 1
	} else {
		exam.Status = -1
	}
	exam.Remark = req.Remark

	if err := model.DB.Save(&exam).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, exam)
}

func ApplyExam(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	userID := GetUserID(c)
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}

	var exam model.Exam
	if err := model.DB.Where("id = ?", id).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	if exam.Status != 1 && exam.Status != 2 {
		Error(c, http.StatusBadRequest, "考期未开放报名")
		return
	}

	if exam.AppliedCount >= exam.TotalSeats {
		Error(c, http.StatusBadRequest, "名额已满")
		return
	}

	var existingApply model.ExamApply
	if err := model.DB.Where("exam_id = ? AND user_id = ?", id, userID).First(&existingApply).Error; err == nil {
		Error(c, http.StatusBadRequest, "已报名该考期")
		return
	}

	applyNo := fmt.Sprintf("AP%s", time.Now().Format("20060102150405"))
	admissionNo := fmt.Sprintf("AD%s%06d", time.Now().Format("2006"), userID)

	examApply := model.ExamApply{
		ExamID:      uint(id),
		UserID:      userID,
		ApplyNo:     applyNo,
		TradeID:     exam.TradeID,
		Level:         exam.Level,
		LevelCode:     exam.LevelCode,
		ApplyStatus:   0,
		PayStatus:     0,
		PayAmount:     0,
		AdmissionNo:   admissionNo,
		ApplyTime:     time.Now(),
	}

	if err := model.DB.Create(&examApply).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	model.DB.Model(&exam).Update("applied_count", exam.AppliedCount + 1)

	Success(c, gin.H{
		"applyNo":     applyNo,
		"admissionNo": admissionNo,
	})
}

func checkExamConflicts(examID, institutionID uint, start, end time.Time) []ConflictInfo {
	var conflicts []ConflictInfo

	workstationConflicts := checkWorkstationConflicts(examID, start, end)
	if len(workstationConflicts) > 0 {
		conflicts = append(conflicts, ConflictInfo{
			Type:        "workstation",
			Description: "考场时间冲突",
			Detail:      workstationConflicts,
		})
	}

	examinerConflicts := checkExaminerConflicts(examID, start, end)
	if len(examinerConflicts) > 0 {
		conflicts = append(conflicts, ConflictInfo{
			Type:        "examiner",
			Description: "考评员时间冲突",
			Detail:      examinerConflicts,
		})
	}

	qualificationConflicts := checkQualificationConflicts(institutionID, start, end)
	if len(qualificationConflicts) > 0 {
		conflicts = append(conflicts, ConflictInfo{
			Type:        "qualification",
			Description: "资质冲突",
			Detail:      qualificationConflicts,
		})
	}

	return conflicts
}

func checkWorkstationConflicts(examID uint, start, end time.Time) []map[string]interface{} {
	var conflicts []map[string]interface{}

	workstationOccupyQuery := model.DB.Table("biz_workstation_occupy").
		Where(`
			occupy_date = ? 
			AND (
				(start_time <= ? AND end_time >= ?)
			OR (start_time <= ? AND end_time >= ?)
			OR (start_time >= ? AND end_time <= ?)
		`, start.Format("2006-01-02"), 
		start.Format("15:04"), start.Format("15:04"),
		end.Format("15:04"), end.Format("15:04"),
		start.Format("15:04"), end.Format("15:04"))

	if examID > 0 {
		workstationOccupyQuery = workstationOccupyQuery.Where("exam_id != ?", examID)
	}

	workstationOccupyQuery.Scan(&conflicts)
	return conflicts
}

func checkExaminerConflicts(examID uint, start, end time.Time) []map[string]interface{} {
	var conflicts []map[string]interface{}

	query := model.DB.Table("biz_examiner_assign").
		Select("biz_examiner_assign.*, biz_schedule.schedule_date, biz_schedule.start_time, biz_schedule.end_time").
		Joins("JOIN biz_schedule ON biz_examiner_assign.schedule_id = biz_schedule.id").
		Where(`
			biz_schedule.schedule_date = ? 
			AND (
				(biz_schedule.start_time <= ? AND biz_schedule.end_time >= ?)
			OR (biz_schedule.start_time <= ? AND biz_schedule.end_time >= ?)
			OR (biz_schedule.start_time >= ? AND biz_schedule.end_time <= ?)
		`, start.Format("2006-01-02"),
		start.Format("15:04"), start.Format("15:04"),
		end.Format("15:04"), end.Format("15:04"),
		start.Format("15:04"), end.Format("15:04"))

	if examID > 0 {
		query = query.Where("biz_examiner_assign.exam_id != ?", examID)
	}

	query.Scan(&conflicts)
	return conflicts
}

func checkQualificationConflicts(institutionID uint, start, end time.Time) []map[string]interface{} {
	var conflicts []map[string]interface{}

	model.DB.Table("biz_examiner_qualification").
		Where("expiry_date < ?", end).
		Scan(&conflicts)

	return conflicts
}

func generateSuggestions(exam model.Exam) []string {
	var suggestions []string

	nextDay := exam.ExamDate.AddDate(0, 0, 1)
	suggestions = append(suggestions, fmt.Sprintf("建议调剂到次日同时段：%s", nextDay.Format("2006-01-02")))

	nextWeek := exam.ExamDate.AddDate(0, 0, 7)
	suggestions = append(suggestions, fmt.Sprintf("建议调剂到下周同时段：%s", nextWeek.Format("2006-01-02")))

	morningTime := "09:00-11:00"
	suggestions = append(suggestions, fmt.Sprintf("建议调剂到上午时段：%s", morningTime))

	return suggestions
}

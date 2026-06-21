package handler

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"exam-system/model"
	_ "exam-system/middleware"

	"github.com/gin-gonic/gin"
)

type WorkstationOccupyCache struct {
	sync.RWMutex
	data map[string][]model.WorkstationOccupy
}

var workstationCache = &WorkstationOccupyCache{
	data: make(map[string][]model.WorkstationOccupy),
}

type AssignScheduleRequest struct {
	ExamID          uint   `json:"examId" binding:"required"`
	WorkstationIDs  []uint `json:"workstationIds" binding:"required,min=1"`
	ExaminerIDs     []uint `json:"examinerIds" binding:"required,min=1"`
}

type ExaminerWarning struct {
	Type         string `json:"type"`
	Level        string `json:"level"`
	Message      string `json:"message"`
	DaysLeft     int    `json:"daysLeft,omitempty"`
	CurrentHours int    `json:"currentHours,omitempty"`
	RequiredHours int   `json:"requiredHours,omitempty"`
}

type BatchConflictItem struct {
	ExamID       uint           `json:"examId"`
	ExamName     string         `json:"examName"`
	HasConflicts bool           `json:"hasConflicts"`
	Conflicts    []ConflictInfo `json:"conflicts"`
}

func init() {
	go refreshWorkstationCache()
}

func refreshWorkstationCache() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		loadWorkstationCache()
	}
}

func loadWorkstationCache() {
	var occupies []model.WorkstationOccupy
	if err := model.DB.Preload("Workstation").Preload("Schedule").Where("status = ?", 1).Find(&occupies).Error; err != nil {
		return
	}

	workstationCache.Lock()
	defer workstationCache.Unlock()

	workstationCache.data = make(map[string][]model.WorkstationOccupy)
	for _, occ := range occupies {
		key := occ.OccupyDate.Format("2006-01-02")
		workstationCache.data[key] = append(workstationCache.data[key], occ)
	}
}

func GetWorkstations(c *gin.Context) {
	var workstations []model.Workstation
	if err := model.DB.Where("status = ?", 1).Find(&workstations).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	result := make([]map[string]interface{}, 0, len(workstations))
	for _, ws := range workstations {
		result = append(result, map[string]interface{}{
			"id":        ws.ID,
			"name":      ws.Name,
			"code":      ws.Code,
			"location":  ws.Location,
			"capacity":  ws.SeatCount,
			"equipment": ws.Equipment,
			"examType":  ws.ExamType,
			"status":    ws.Status,
		})
	}

	Success(c, result)
}

func GetAvailableExaminers(c *gin.Context) {
	startTimeStr := c.Query("startTime")
	endTimeStr := c.Query("endTime")
	tradeIdStr := c.Query("tradeId")
	level := c.Query("level")

	if startTimeStr == "" || endTimeStr == "" || tradeIdStr == "" || level == "" {
		Error(c, http.StatusBadRequest, "缺少必要参数")
		return
	}

	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "开始时间格式错误")
		return
	}

	endTime, err := time.Parse(time.RFC3339, endTimeStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "结束时间格式错误")
		return
	}

	tradeId, err := strconv.ParseUint(tradeIdStr, 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "工种ID格式错误")
		return
	}

	var user model.User
	userID := GetUserID(c)
	if err := model.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取用户信息失败")
		return
	}

	var qualifications []model.ExaminerQualification
	query := model.DB.Preload("Examiner").Preload("Trade").
		Where("trade_id = ? AND level = ? AND status = ?", tradeId, level, 1).
		Where("expiry_date > ?", endTime)

	if err := query.Find(&qualifications).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	examinerIDs := make([]uint, 0, len(qualifications))
	qualificationMap := make(map[uint]model.ExaminerQualification)
	for _, q := range qualifications {
		examinerIDs = append(examinerIDs, q.ExaminerID)
		qualificationMap[q.ExaminerID] = q
	}

	if len(examinerIDs) == 0 {
		Success(c, []interface{}{})
		return
	}

	if user.InstitutionID != nil {
		var institutionUsers []model.User
		model.DB.Where("institution_id = ? AND role = ?", *user.InstitutionID, RoleExaminer).Find(&institutionUsers)
		excludeIDs := make([]uint, 0, len(institutionUsers))
		for _, u := range institutionUsers {
			excludeIDs = append(excludeIDs, u.ID)
		}
		if len(excludeIDs) > 0 {
			filteredIDs := make([]uint, 0, len(examinerIDs))
			for _, id := range examinerIDs {
				excluded := false
				for _, eid := range excludeIDs {
					if id == eid {
						excluded = true
						break
					}
				}
				if !excluded {
					filteredIDs = append(filteredIDs, id)
				}
			}
			examinerIDs = filteredIDs
		}
	}

	var assignments []model.ExaminerAssign
	assignQuery := model.DB.Preload("Schedule").
		Where("examiner_id IN ? AND status = ?", examinerIDs, 1).
		Where("EXISTS (SELECT 1 FROM biz_schedule WHERE biz_schedule.id = biz_examiner_assign.schedule_id AND biz_schedule.schedule_date = ? AND ((biz_schedule.start_time <= ? AND biz_schedule.end_time >= ?) OR (biz_schedule.start_time <= ? AND biz_schedule.end_time >= ?) OR (biz_schedule.start_time >= ? AND biz_schedule.end_time <= ?)))",
			startTime.Format("2006-01-02"),
			startTime.Format("15:04"), startTime.Format("15:04"),
			endTime.Format("15:04"), endTime.Format("15:04"),
			startTime.Format("15:04"), endTime.Format("15:04"))

	if err := assignQuery.Find(&assignments).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	assignedIDs := make(map[uint]bool)
	for _, a := range assignments {
		assignedIDs[a.ExaminerID] = true
	}

	availableIDs := make([]uint, 0)
	for _, id := range examinerIDs {
		if !assignedIDs[id] {
			availableIDs = append(availableIDs, id)
		}
	}

	var examiners []model.User
	if err := model.DB.Where("id IN ?", availableIDs).Find(&examiners).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	result := make([]map[string]interface{}, 0, len(examiners))
	for _, e := range examiners {
		q := qualificationMap[e.ID]
		result = append(result, map[string]interface{}{
			"id":              e.ID,
			"realName":        e.RealName,
			"phone":           e.Phone,
			"tradeId":         q.TradeID,
			"tradeName":       q.Trade.Name,
			"level":           q.Level,
			"certificateNo":   q.CertificateNo,
			"expiryDate":      q.ExpiryDate,
			"institutionId":   e.InstitutionID,
		})
	}

	Success(c, result)
}

func BatchCheckConflicts(c *gin.Context) {
	examIdsStr := c.Query("examIds")
	if examIdsStr == "" {
		Error(c, http.StatusBadRequest, "缺少examIds参数")
		return
	}

	examIdStrs := strings.Split(examIdsStr, ",")
	examIDs := make([]uint, 0, len(examIdStrs))
	for _, idStr := range examIdStrs {
		id, err := strconv.ParseUint(strings.TrimSpace(idStr), 10, 32)
		if err != nil {
			Error(c, http.StatusBadRequest, "examIds格式错误")
			return
		}
		examIDs = append(examIDs, uint(id))
	}

	var exams []model.Exam
	if err := model.DB.Preload("Institution").Preload("Trade").Where("id IN ?", examIDs).Find(&exams).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	result := make([]BatchConflictItem, 0, len(exams))
	for _, exam := range exams {
		examEnd := exam.ExamDate.Add(time.Duration(exam.Duration) * time.Minute)
		conflicts := checkExamConflicts(exam.ID, exam.InstitutionID, exam.ExamDate, examEnd)

		result = append(result, BatchConflictItem{
			ExamID:       exam.ID,
			ExamName:     exam.Name,
			HasConflicts: len(conflicts) > 0,
			Conflicts:    conflicts,
		})
	}

	Success(c, result)
}

func AssignSchedule(c *gin.Context) {
	var req AssignScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	var exam model.Exam
	if err := model.DB.Where("id = ?", req.ExamID).First(&exam).Error; err != nil {
		Error(c, http.StatusNotFound, "考期不存在")
		return
	}

	var workstations []model.Workstation
	if err := model.DB.Where("id IN ?", req.WorkstationIDs).Find(&workstations).Error; err != nil {
		Error(c, http.StatusBadRequest, "部分考场不存在")
		return
	}
	if len(workstations) != len(req.WorkstationIDs) {
		Error(c, http.StatusBadRequest, "部分考场不存在")
		return
	}

	var examiners []model.User
	if err := model.DB.Where("id IN ? AND role = ?", req.ExaminerIDs, RoleExaminer).Find(&examiners).Error; err != nil {
		Error(c, http.StatusBadRequest, "部分考评员不存在")
		return
	}
	if len(examiners) != len(req.ExaminerIDs) {
		Error(c, http.StatusBadRequest, "部分考评员不存在或不是考评员角色")
		return
	}

	tx := model.DB.Begin()

	schedules := make([]model.Schedule, 0, len(req.WorkstationIDs))
	for _, wsID := range req.WorkstationIDs {
		schedule := model.Schedule{
			ExamID:         req.ExamID,
			WorkstationID:  wsID,
			ScheduleDate:   exam.ExamDate,
			StartTime:      exam.StartTime,
			EndTime:        exam.EndTime,
			Status:         1,
		}
		if err := tx.Create(&schedule).Error; err != nil {
			tx.Rollback()
			Error(c, http.StatusInternalServerError, "创建排期失败: "+err.Error())
			return
		}
		schedules = append(schedules, schedule)
	}

	assignments := make([]model.ExaminerAssign, 0, len(req.ExaminerIDs)*len(schedules))
	for _, schedule := range schedules {
		for i, examinerID := range req.ExaminerIDs {
			assignRole := "examiner"
			if i == 0 {
				assignRole = "chief"
			}
			assign := model.ExaminerAssign{
				ExamID:       req.ExamID,
				ExaminerID:   examinerID,
				ScheduleID:   schedule.ID,
				AssignRole:   assignRole,
				Status:       1,
			}
			if err := tx.Create(&assign).Error; err != nil {
				tx.Rollback()
				Error(c, http.StatusInternalServerError, "创建考评员派遣失败: "+err.Error())
				return
			}
			assignments = append(assignments, assign)
		}
	}

	for _, schedule := range schedules {
		occupy := model.WorkstationOccupy{
			WorkstationID: schedule.WorkstationID,
			ScheduleID:    schedule.ID,
			ExamID:        req.ExamID,
			OccupyDate:    exam.ExamDate,
			StartTime:     exam.StartTime,
			EndTime:       exam.EndTime,
			Status:        1,
		}
		if err := tx.Create(&occupy).Error; err != nil {
			tx.Rollback()
			Error(c, http.StatusInternalServerError, "记录工位占用失败: "+err.Error())
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		Error(c, http.StatusInternalServerError, "提交事务失败: "+err.Error())
		return
	}

	go loadWorkstationCache()

	Success(c, gin.H{
		"schedules":   schedules,
		"assignments": assignments,
	})
}

func GetExaminerList(c *gin.Context) {
	page, pageSize := GetPageParams(c)
	tradeID := c.Query("tradeId")
	status := c.Query("status")

	query := model.DB.Model(&model.User{}).Where("role = ?", RoleExaminer)

	if tradeID != "" {
		query = query.Where("EXISTS (SELECT 1 FROM biz_examiner_qualification WHERE biz_examiner_qualification.examiner_id = sys_user.id AND biz_examiner_qualification.trade_id = ? AND biz_examiner_qualification.status = 1)", tradeID)
	}

	if status != "" {
		statusInt, _ := strconv.Atoi(status)
		query = query.Where("status = ?", statusInt)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var users []model.User
	if err := query.Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	result := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		var qualifications []model.ExaminerQualification
		model.DB.Preload("Trade").Where("examiner_id = ?", u.ID).Find(&qualifications)

		result = append(result, map[string]interface{}{
			"id":              u.ID,
			"realName":        u.RealName,
			"username":        u.Username,
			"phone":           u.Phone,
			"email":           u.Email,
			"idCard":          u.IDCard,
			"status":          u.Status,
			"institutionId":   u.InstitutionID,
			"qualifications":  qualifications,
			"createdAt":       u.CreatedAt,
		})
	}

	PageSuccess(c, result, total, page, pageSize)
}

func GetExaminerWarnings(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var examiner model.User
	if err := model.DB.Where("id = ?", id).First(&examiner).Error; err != nil {
		Error(c, http.StatusNotFound, "考评员不存在")
		return
	}

	var warnings []ExaminerWarning

	var qualifications []model.ExaminerQualification
	if err := model.DB.Preload("Trade").Where("examiner_id = ?", id).Find(&qualifications).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	now := time.Now()
	for _, q := range qualifications {
		daysLeft := int(q.ExpiryDate.Sub(now).Hours() / 24)
		if daysLeft <= 30 {
			level := "warning"
			if daysLeft <= 0 {
				level = "danger"
			}
			warnings = append(warnings, ExaminerWarning{
				Type:     "expiry",
				Level:    level,
				Message:  q.Trade.Name + " " + q.Level + " 资质聘期将在 " + strconv.Itoa(daysLeft) + " 天后过期",
				DaysLeft: daysLeft,
			})
		}
	}

	continueEducationHours := 0
	requiredHours := 36

	var ceRecords []model.ContinuingEducation
	currentYear := time.Now().Year()
	ceQuery := model.DB.Where("examiner_id = ? AND status = 1", id)
	ceQuery = ceQuery.Where("(strftime('%Y', start_date) = ? OR strftime('%Y', end_date) = ?)",
		strconv.Itoa(currentYear), strconv.Itoa(currentYear))
	if err := ceQuery.Find(&ceRecords).Error; err == nil {
		for _, r := range ceRecords {
			continueEducationHours += r.Hours
		}
	}

	if continueEducationHours < requiredHours {
		warnings = append(warnings, ExaminerWarning{
			Type:          "education",
			Level:         "warning",
			Message:       "继续教育学时不足，当前 " + strconv.Itoa(continueEducationHours) + " 小时，需完成 " + strconv.Itoa(requiredHours) + " 小时",
			CurrentHours:  continueEducationHours,
			RequiredHours: requiredHours,
		})
	}

	var institutionUsers []model.User
	if examiner.InstitutionID != nil {
		model.DB.Where("institution_id = ? AND id != ?", *examiner.InstitutionID, id).Find(&institutionUsers)
		if len(institutionUsers) > 0 {
			relatedNames := make([]string, 0, len(institutionUsers))
			for _, u := range institutionUsers {
				relatedNames = append(relatedNames, u.RealName)
			}
			warnings = append(warnings, ExaminerWarning{
				Type:    "avoidance",
				Level:   "info",
				Message: "存在回避单位关系：与 " + strings.Join(relatedNames, "、") + " 属同一单位",
			})
		}
	}

	Success(c, gin.H{
		"examinerId": id,
		"warnings":   warnings,
	})
}

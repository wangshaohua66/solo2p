package handler

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"exam-system/model"
	_ "exam-system/middleware"
)

type ScoreImportRow struct {
	RowNum        int
	AdmissionNo   string
	IDCard        string
	TheoryScore   float64
	PracticeScore float64
	TotalScore    float64
	Absent        bool
	Errors        []string
}

type ValidateResult struct {
	Total   int                      `json:"total"`
	Success int                      `json:"success"`
	Failed  int                      `json:"failed"`
	Errors  []map[string]interface{} `json:"errors"`
}

type ReviewScoreRequest struct {
	TheoryScore   float64 `json:"theoryScore" binding:"required,min=0,max=100"`
	PracticeScore float64 `json:"practiceScore" binding:"required,min=0,max=100"`
	TotalScore    float64 `json:"totalScore" binding:"required,min=0,max=100"`
	ReviewRemark  string  `json:"reviewRemark"`
}

const (
	ScoreStatusPending   = 0
	ScoreStatusReviewed  = 1
	ScoreStatusPublished = 2
)

const (
	PoolSize      = 10
	BatchSize     = 100
	MaxGoroutines = 50
)

var idCardRegex = regexp.MustCompile(`^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$`)

func GetScoreList(c *gin.Context) {
	page, pageSize := GetPageParams(c)
	userRole := GetUserRole(c)
	userID := GetUserID(c)

	examID := c.Query("examId")
	status := c.Query("status")

	query := model.DB.Model(&model.Score{}).
		Preload("Exam").Preload("User").Preload("Trade").Preload("ExamApply")

	if userRole != RoleAdmin {
		var user model.User
		if err := model.DB.Where("id = ?", userID).First(&user).Error; err == nil {
			if userRole == RoleInstitution && user.InstitutionID != nil {
				subQuery := model.DB.Model(&model.Exam{}).
					Select("id").
					Where("institution_id = ?", *user.InstitutionID)
				query = query.Where("exam_id IN (?)", subQuery)
			} else if userRole == RoleExaminer {
				subQuery := model.DB.Model(&model.ExaminerAssign{}).
					Select("exam_id").
					Where("examiner_id = ?", userID)
				query = query.Where("exam_id IN (?)", subQuery)
			} else if userRole == RoleExaminee {
				query = query.Where("user_id = ?", userID)
			}
		}
	}

	if examID != "" {
		query = query.Where("exam_id = ?", examID)
	}

	if status != "" {
		statusInt, err := strconv.Atoi(status)
		if err == nil {
			query = query.Where("score_status = ?", statusInt)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var scores []model.Score
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&scores).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	PageSuccess(c, scores, total, page, pageSize)
}

func BatchImportScores(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		Error(c, http.StatusBadRequest, "请上传Excel文件")
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		Error(c, http.StatusBadRequest, "Excel文件格式错误")
		return
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.Rows(sheetName)
	if err != nil {
		Error(c, http.StatusBadRequest, "读取Excel失败")
		return
	}
	defer rows.Close()

	var importRows []ScoreImportRow
	rowNum := 0

	for rows.Next() {
		rowNum++
		if rowNum == 1 {
			continue
		}

		columns, err := rows.Columns()
		if err != nil {
			continue
		}

		if len(columns) < 5 {
			continue
		}

		row := ScoreImportRow{RowNum: rowNum}
		row.AdmissionNo = columns[0]
		row.IDCard = columns[1]

		if len(columns) > 2 && columns[2] != "" {
			row.TheoryScore, _ = strconv.ParseFloat(columns[2], 64)
		}
		if len(columns) > 3 && columns[3] != "" {
			row.PracticeScore, _ = strconv.ParseFloat(columns[3], 64)
		}
		if len(columns) > 4 && columns[4] != "" {
			row.TotalScore, _ = strconv.ParseFloat(columns[4], 64)
		}
		if len(columns) > 5 && columns[5] == "是" {
			row.Absent = true
		}

		importRows = append(importRows, row)

		if len(importRows) >= BatchSize {
			if err := processImportBatch(importRows); err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			importRows = nil
		}
	}

	if len(importRows) > 0 {
		if err := processImportBatch(importRows); err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
	}

	Success(c, gin.H{"message": "导入成功"})
}

func processImportBatch(rows []ScoreImportRow) error {
	validateResult := validateScoreRows(rows)
	if validateResult.Failed > 0 {
		return errors.New("数据校验失败，请先校验数据")
	}

	tx := model.DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	for _, row := range rows {
		var examApply model.ExamApply
		if err := tx.Where("admission_no = ?", row.AdmissionNo).First(&examApply).Error; err != nil {
			tx.Rollback()
			return err
		}

		var existingScore model.Score
		err := tx.Where("exam_apply_id = ?", examApply.ID).First(&existingScore).Error

		passStatus := 0
		if row.TotalScore >= 60 {
			passStatus = 1
		}

		now := time.Now()

		if err == nil {
			existingScore.TheoryScore = &row.TheoryScore
			existingScore.PracticeScore = &row.PracticeScore
			existingScore.TotalScore = &row.TotalScore
			existingScore.PassStatus = &passStatus
			existingScore.UpdatedAt = now
			if err := tx.Save(&existingScore).Error; err != nil {
				tx.Rollback()
				return err
			}
		} else {
			score := model.Score{
				ExamApplyID: examApply.ID,
				ExamID:      examApply.ExamID,
				UserID:      examApply.UserID,
				TradeID:     examApply.TradeID,
				TheoryScore: &row.TheoryScore,
				PracticeScore: &row.PracticeScore,
				TotalScore:    &row.TotalScore,
				PassStatus:    &passStatus,
				ScoreStatus:   ScoreStatusPending,
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			if err := tx.Create(&score).Error; err != nil {
				tx.Rollback()
				return err
			}
		}
	}

	return tx.Commit().Error
}

func ValidateScores(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		Error(c, http.StatusBadRequest, "请上传Excel文件")
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		Error(c, http.StatusBadRequest, "Excel文件格式错误")
		return
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.Rows(sheetName)
	if err != nil {
		Error(c, http.StatusBadRequest, "读取Excel失败")
		return
	}
	defer rows.Close()

	var allRows []ScoreImportRow
	rowNum := 0

	for rows.Next() {
		rowNum++
		if rowNum == 1 {
			continue
		}

		columns, err := rows.Columns()
		if err != nil {
			continue
		}

		row := ScoreImportRow{RowNum: rowNum}
		if len(columns) > 0 {
			row.AdmissionNo = columns[0]
		}
		if len(columns) > 1 {
			row.IDCard = columns[1]
		}
		if len(columns) > 2 && columns[2] != "" {
			row.TheoryScore, _ = strconv.ParseFloat(columns[2], 64)
		}
		if len(columns) > 3 && columns[3] != "" {
			row.PracticeScore, _ = strconv.ParseFloat(columns[3], 64)
		}
		if len(columns) > 4 && columns[4] != "" {
			row.TotalScore, _ = strconv.ParseFloat(columns[4], 64)
		}
		if len(columns) > 5 && columns[5] == "是" {
			row.Absent = true
		}

		allRows = append(allRows, row)
	}

	result := validateScoreRows(allRows)
	Success(c, result)
}

func validateScoreRows(rows []ScoreImportRow) ValidateResult {
	result := ValidateResult{
		Total:  len(rows),
		Errors: make([]map[string]interface{}, 0),
	}

	if len(rows) == 0 {
		return result
	}

	admissionNos := make([]string, 0, len(rows))
	for _, row := range rows {
		admissionNos = append(admissionNos, row.AdmissionNo)
	}

	var validApplies []model.ExamApply
	model.DB.Where("admission_no IN ?", admissionNos).Find(&validApplies)

	validAdmissionMap := make(map[string]model.ExamApply)
	for _, apply := range validApplies {
		validAdmissionMap[apply.AdmissionNo] = apply
	}

	jobChan := make(chan int, MaxGoroutines)
	var wg sync.WaitGroup
	var mu sync.Mutex

	poolSize := PoolSize
	if len(rows) < poolSize {
		poolSize = len(rows)
	}

	for i := 0; i < poolSize; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobChan {
				row := &rows[idx]
				validateSingleRow(row, validAdmissionMap)

				mu.Lock()
				if len(row.Errors) > 0 {
					result.Failed++
					result.Errors = append(result.Errors, map[string]interface{}{
						"rowNum": row.RowNum,
						"errors": row.Errors,
					})
				} else {
					result.Success++
				}
				mu.Unlock()
			}
		}()
	}

	for i := range rows {
		jobChan <- i
	}
	close(jobChan)
	wg.Wait()

	return result
}

func validateSingleRow(row *ScoreImportRow, validAdmissionMap map[string]model.ExamApply) {
	if row.AdmissionNo == "" {
		row.Errors = append(row.Errors, "准考证号不能为空")
	} else if _, exists := validAdmissionMap[row.AdmissionNo]; !exists {
		row.Errors = append(row.Errors, fmt.Sprintf("准考证号 %s 不存在报名记录", row.AdmissionNo))
	}

	if row.IDCard == "" {
		row.Errors = append(row.Errors, "身份证号不能为空")
	} else if !idCardRegex.MatchString(row.IDCard) {
		row.Errors = append(row.Errors, "身份证号格式不正确")
	}

	if !row.Absent {
		if row.TheoryScore < 0 || row.TheoryScore > 100 {
			row.Errors = append(row.Errors, "理论成绩必须在0-100之间")
		}
		if row.PracticeScore < 0 || row.PracticeScore > 100 {
			row.Errors = append(row.Errors, "实操成绩必须在0-100之间")
		}
		if row.TotalScore < 0 || row.TotalScore > 100 {
			row.Errors = append(row.Errors, "总成绩必须在0-100之间")
		}

		calculatedTotal := row.TheoryScore*0.5 + row.PracticeScore*0.5
		if row.TotalScore > 0 && calculatedTotal > 0 {
			diff := row.TotalScore - calculatedTotal
			if diff > 0.01 || diff < -0.01 {
				row.Errors = append(row.Errors, "总成绩与理论+实操计算结果不一致")
			}
		}
	} else {
		if row.TheoryScore > 0 || row.PracticeScore > 0 || row.TotalScore > 0 {
			row.Errors = append(row.Errors, "缺考标记与成绩数据不一致")
		}
	}

	if apply, exists := validAdmissionMap[row.AdmissionNo]; exists {
		var user model.User
		if err := model.DB.Where("id = ?", apply.UserID).First(&user).Error; err == nil {
			if user.IDCard != row.IDCard {
				row.Errors = append(row.Errors, "身份证号与报名信息不一致")
			}
		}
	}
}

func ReviewScore(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var req ReviewScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	var score model.Score
	if err := model.DB.Where("id = ?", id).First(&score).Error; err != nil {
		Error(c, http.StatusNotFound, "成绩记录不存在")
		return
	}

	if score.ScoreStatus != ScoreStatusPending {
		Error(c, http.StatusBadRequest, "当前状态不允许复核")
		return
	}

	reviewerID := GetUserID(c)
	now := time.Now()
	passStatus := 0
	if req.TotalScore >= 60 {
		passStatus = 1
	}

	score.TheoryScore = &req.TheoryScore
	score.PracticeScore = &req.PracticeScore
	score.TotalScore = &req.TotalScore
	score.PassStatus = &passStatus
	score.ScoreStatus = ScoreStatusReviewed
	score.ReviewerID = &reviewerID
	score.ReviewTime = &now
	score.Remark = req.ReviewRemark

	if err := model.DB.Save(&score).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, score)
}

func PublishScore(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的ID")
		return
	}

	var score model.Score
	if err := model.DB.Where("id = ?", id).First(&score).Error; err != nil {
		Error(c, http.StatusNotFound, "成绩记录不存在")
		return
	}

	if score.ScoreStatus != ScoreStatusReviewed {
		Error(c, http.StatusBadRequest, "请先完成复核")
		return
	}

	score.ScoreStatus = ScoreStatusPublished
	score.UpdatedAt = time.Now()

	if err := model.DB.Save(&score).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{"message": "发布成功", "passStatus": *score.PassStatus})
}

func GetMyScores(c *gin.Context) {
	page, pageSize := GetPageParams(c)
	userID := GetUserID(c)

	if userID == 0 {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}

	query := model.DB.Model(&model.Score{}).
		Preload("Exam").Preload("Trade").
		Where("user_id = ? AND score_status = ?", userID, ScoreStatusPublished)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var scores []model.Score
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&scores).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	PageSuccess(c, scores, total, page, pageSize)
}

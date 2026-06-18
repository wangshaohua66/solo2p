package service

import (
	"fmt"
	"gas-network-system/internal/config"
	"gas-network-system/internal/model"
	"gas-network-system/internal/repository"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type AssessmentService struct {
	Repo   *repository.Repository
	logger *zap.Logger
	config *config.Config
}

func NewAssessmentService(repo *repository.Repository, logger *zap.Logger, cfg *config.Config) *AssessmentService {
	return &AssessmentService{
		Repo:   repo,
		logger: logger,
		config: cfg,
	}
}

type GenerateAssessmentRequest struct {
	Year        int `json:"year" binding:"required"`
	Month       int `json:"month" binding:"required,min=1,max=12"`
	InspectorID uint `json:"inspector_id"`
}

type AssessmentResult struct {
	Generated int    `json:"generated"`
	Skipped   int    `json:"skipped"`
	Message   string `json:"message"`
}

func (s *AssessmentService) GenerateMonthlyAssessment(req GenerateAssessmentRequest) (AssessmentResult, error) {
	startTime := time.Date(req.Year, time.Month(req.Month), 1, 0, 0, 0, 0, time.Local)
	endTime := startTime.AddDate(0, 1, 0)

	var inspectors []model.Inspector
	var err error

	if req.InspectorID > 0 {
		insp, getErr := s.Repo.Inspector.GetByID(req.InspectorID)
		if getErr != nil {
			return AssessmentResult{}, getErr
		}
		inspectors = []model.Inspector{*insp}
	} else {
		inspectors, err = s.Repo.Assessment.GetAllInspectors()
		if err != nil {
			return AssessmentResult{}, err
		}
	}

	var assessments []model.MonthlyAssessment
	skipped := 0

	for _, inspector := range inspectors {
		existing, findErr := s.Repo.Assessment.GetByInspectorAndMonth(inspector.ID, req.Year, req.Month)
		if findErr == nil && existing != nil {
			skipped++
			continue
		}

		totalTasks, completedTasks, statErr := s.Repo.Assessment.GetTaskStats(inspector.ID, startTime, endTime)
		if statErr != nil {
			s.logger.Warn("获取任务统计失败",
				zap.Uint("inspector_id", inspector.ID),
				zap.Error(statErr))
			continue
		}

		trackDeviations, devErr := s.Repo.Assessment.GetTrackDeviations(inspector.ID, startTime, endTime)
		if devErr != nil {
			s.logger.Warn("获取轨迹偏差统计失败",
				zap.Uint("inspector_id", inspector.ID),
				zap.Error(devErr))
			continue
		}

		hazardsReported, hazardsClosed, hazErr := s.Repo.Assessment.GetHazardStats(inspector.ID, startTime, endTime)
		if hazErr != nil {
			s.logger.Warn("获取隐患统计失败",
				zap.Uint("inspector_id", inspector.ID),
				zap.Error(hazErr))
			continue
		}

		completionRate := 0.0
		if totalTasks > 0 {
			completionRate = float64(completedTasks) / float64(totalTasks) * 100
		}

		taskScore := completionRate
		trackScore := 100.0
		if totalTasks > 0 {
			trackScore = 100.0 - (float64(trackDeviations)/float64(totalTasks))*100
			if trackScore < 0 {
				trackScore = 0
			}
		}
		hazardScore := 100.0
		if hazardsReported > 0 {
			hazardScore = float64(hazardsClosed) / float64(hazardsReported) * 100
		}

		totalScore := s.config.Assessment.TaskCompletionWeight*taskScore +
			s.config.Assessment.TrackDeviationWeight*trackScore +
			s.config.Assessment.HazardReportWeight*hazardScore

		grade := calculateGrade(totalScore)
		isPassed := totalScore >= s.config.Assessment.PassScore

		report := s.generateReport(inspector, req.Year, req.Month,
			int(totalTasks), int(completedTasks), completionRate,
			trackDeviations, hazardsReported, hazardsClosed,
			taskScore, trackScore, hazardScore, totalScore, grade)

		assessmentNo := fmt.Sprintf("MA-%d%02d-%s", req.Year, req.Month, uuid.New().String()[:8])

		assessment := model.MonthlyAssessment{
			AssessmentNo:    assessmentNo,
			InspectorID:     inspector.ID,
			Year:            req.Year,
			Month:           req.Month,
			TotalTasks:      int(totalTasks),
			CompletedTasks:  int(completedTasks),
			CompletionRate:  roundTo2(completionRate),
			TrackDeviations: int(trackDeviations),
			HazardsReported: int(hazardsReported),
			HazardsClosed:   int(hazardsClosed),
			TaskScore:       roundTo2(taskScore),
			TrackScore:      roundTo2(trackScore),
			HazardScore:     roundTo2(hazardScore),
			TotalScore:      roundTo2(totalScore),
			Grade:           grade,
			IsPassed:        isPassed,
			Report:          report,
			GeneratedAt:     time.Now(),
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		assessments = append(assessments, assessment)
	}

	if len(assessments) == 0 {
		return AssessmentResult{
			Generated: 0,
			Skipped:   skipped,
			Message:   fmt.Sprintf("无新考核需要生成（跳过%d条已存在考核）", skipped),
		}, nil
	}

	if err := s.Repo.Assessment.BatchCreate(assessments); err != nil {
		return AssessmentResult{}, err
	}

	s.logger.Info("月度考核生成完成",
		zap.Int("generated", len(assessments)),
		zap.Int("skipped", skipped),
		zap.Int("year", req.Year),
		zap.Int("month", req.Month),
	)

	return AssessmentResult{
		Generated: len(assessments),
		Skipped:   skipped,
		Message:   fmt.Sprintf("成功生成%d条考核记录，跳过%d条已存在记录", len(assessments), skipped),
	}, nil
}

func calculateGrade(score float64) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 60:
		return "C"
	default:
		return "D"
	}
}

func (s *AssessmentService) generateReport(inspector model.Inspector, year, month int,
	totalTasks, completedTasks int, completionRate float64,
	trackDeviations int64, hazardsReported, hazardsClosed int64,
	taskScore, trackScore, hazardScore, totalScore float64, grade string) string {

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("【月度考核报告】%d年%d月\n", year, month))
	sb.WriteString(fmt.Sprintf("巡检员：%s（工号：%s）\n\n", inspector.Name, inspector.EmployeeNo))
	sb.WriteString("━━━ 统计数据 ━━━\n")
	sb.WriteString(fmt.Sprintf("任务总数：%d\n", totalTasks))
	sb.WriteString(fmt.Sprintf("已完成任务：%d\n", completedTasks))
	sb.WriteString(fmt.Sprintf("任务完成率：%.1f%%\n", completionRate))
	sb.WriteString(fmt.Sprintf("轨迹偏差次数：%d\n", trackDeviations))
	sb.WriteString(fmt.Sprintf("隐患上报数：%d\n", hazardsReported))
	sb.WriteString(fmt.Sprintf("隐患已闭环数：%d\n\n", hazardsClosed))
	sb.WriteString("━━━ 评分明细 ━━━\n")
	sb.WriteString(fmt.Sprintf("任务完成评分：%.1f\n", taskScore))
	sb.WriteString(fmt.Sprintf("轨迹规范评分：%.1f\n", trackScore))
	sb.WriteString(fmt.Sprintf("隐患闭环评分：%.1f\n", hazardScore))
	sb.WriteString(fmt.Sprintf("综合得分：%.1f\n\n", totalScore))
	sb.WriteString(fmt.Sprintf("考核等级：%s\n", grade))

	switch grade {
	case "A":
		sb.WriteString("评价：优秀，工作表现突出，继续保持。\n")
	case "B":
		sb.WriteString("评价：良好，工作达标，仍有提升空间。\n")
	case "C":
		sb.WriteString("评价：合格，需加强任务完成率和隐患闭环管理。\n")
	case "D":
		sb.WriteString("评价：不合格，需重点关注并制定改进计划。\n")
	}

	return sb.String()
}

func roundTo2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

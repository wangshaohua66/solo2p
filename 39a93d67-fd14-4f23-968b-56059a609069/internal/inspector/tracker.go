package inspector

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"eco-inspector/internal/database"
	"eco-inspector/pkg/logger"

	"github.com/google/uuid"
)

type Status string

const (
	StatusPending    Status = "待整改"
	StatusInProgress Status = "整改中"
	StatusReview     Status = "待验收"
	StatusClosed     Status = "已销号"
)

var validStatusTransitions = map[Status][]Status{
	StatusPending:    {StatusInProgress},
	StatusInProgress: {StatusReview, StatusPending},
	StatusReview:     {StatusClosed, StatusInProgress},
	StatusClosed:    {},
}

type ProblemType string

const (
	ProblemAir      ProblemType = "大气污染"
	ProblemWater    ProblemType = "水污染"
	ProblemSolid    ProblemType = "固废管理"
	ProblemEIA      ProblemType = "环评手续"
)

func IsValidProblemType(t string) bool {
	return t == string(ProblemAir) || t == string(ProblemWater) || t == string(ProblemSolid) || t == string(ProblemEIA)
}

type Rectification struct {
	ID                string `json:"id"`
	EnterpriseID      string `json:"enterprise_id"`
	EnterpriseName    string `json:"enterprise_name,omitempty"`
	ProblemType       string `json:"problem_type"`
	ProblemDesc       string `json:"problem_desc"`
	Deadline          string `json:"deadline"`
	ResponsiblePerson string `json:"responsible_person"`
	AcceptanceCriteria string `json:"acceptance_criteria"`
	Status            string `json:"status"`
	InspectorRound    string `json:"inspector_round"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
}

type ProgressReport struct {
	ID             string `json:"id"`
	RectificationID string `json:"rectification_id"`
	ReportType     string `json:"report_type"`
	Content        string `json:"content"`
	Attachment     string `json:"attachment"`
	Reviewer       string `json:"reviewer"`
	ReviewComment  string `json:"review_comment"`
	ReviewedAt     string `json:"reviewed_at,omitempty"`
	CreatedAt      string `json:"created_at"`
}

type Tracker struct{}

func NewTracker() *Tracker {
	return &Tracker{}
}

func (t *Tracker) Create(r *Rectification) error {
	if r.ID == "" {
		r.ID = "ZG" + uuid.New().String()[:8]
	}
	if r.EnterpriseID == "" {
		return fmt.Errorf("企业ID不能为空")
	}
	if !IsValidProblemType(r.ProblemType) {
		return fmt.Errorf("问题类型无效，应为: 大气污染、水污染、固废管理、环评手续")
	}
	if r.ProblemDesc == "" {
		return fmt.Errorf("问题描述不能为空")
	}
	if r.Deadline == "" {
		return fmt.Errorf("整改期限不能为空")
	}
	deadline, err := time.Parse("2006-01-02", r.Deadline)
	if err != nil {
		return fmt.Errorf("整改期限格式错误，应为: YYYY-MM-DD")
	}
	if deadline.Before(time.Now()) {
		return fmt.Errorf("整改期限不能早于当前日期")
	}
	if r.Status == "" {
		r.Status = string(StatusPending)
	}
	if r.Status != string(StatusPending) {
		return fmt.Errorf("新建整改事项状态必须为'待整改'")
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	r.CreatedAt = now
	r.UpdatedAt = now

	_, err = database.DB.Exec(`
		INSERT INTO rectifications (id, enterprise_id, problem_type, problem_desc, deadline, responsible_person, acceptance_criteria, status, inspector_round, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.EnterpriseID, r.ProblemType, r.ProblemDesc, r.Deadline, r.ResponsiblePerson, r.AcceptanceCriteria, r.Status, r.InspectorRound, r.CreatedAt, r.UpdatedAt)

	if err != nil {
		logger.Error("创建整改事项失败", map[string]string{"error": err.Error(), "target": r.ID})
		return fmt.Errorf("创建整改事项失败: %w", err)
	}

	logger.LogAction("system", "创建整改事项", r.ID, "成功")
	return nil
}

func (t *Tracker) GetByID(id string) (*Rectification, error) {
	r := &Rectification{}
	err := database.DB.QueryRow(`
		SELECT r.id, r.enterprise_id, e.name, r.problem_type, r.problem_desc, r.deadline, r.responsible_person, r.acceptance_criteria, r.status, r.inspector_round, r.created_at, r.updated_at
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		WHERE r.id = ?`, id).
		Scan(&r.ID, &r.EnterpriseID, &r.EnterpriseName, &r.ProblemType, &r.ProblemDesc, &r.Deadline, &r.ResponsiblePerson, &r.AcceptanceCriteria, &r.Status, &r.InspectorRound, &r.CreatedAt, &r.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("整改事项不存在: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("查询整改事项失败: %w", err)
	}
	return r, nil
}

func (t *Tracker) UpdateStatus(id string, newStatus Status, operator string) error {
	r, err := t.GetByID(id)
	if err != nil {
		return err
	}

	oldStatus := Status(r.Status)
	allowed, ok := validStatusTransitions[oldStatus]
	if !ok {
		return fmt.Errorf("当前状态无效: %s", oldStatus)
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("状态流转无效: %s → %s，允许的目标状态: %v", oldStatus, newStatus, allowed)
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	result, err := database.DB.Exec(`
		UPDATE rectifications SET status=?, updated_at=? WHERE id=?`,
		string(newStatus), now, id)
	if err != nil {
		return fmt.Errorf("更新整改状态失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("整改事项不存在: %s", id)
	}

	logger.LogAction(operator, "更新整改状态", id, fmt.Sprintf("%s→%s", oldStatus, newStatus))
	return nil
}

type RectListFilter struct {
	EnterpriseID string
	ProblemType  string
	Status       string
	DeadlineFrom string
	DeadlineTo   string
	Keyword      string
	Page         int
	PageSize     int
}

type RectListResult struct {
	Items    []Rectification `json:"items"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

func (t *Tracker) List(filter RectListFilter) (*RectListResult, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}

	var conditions []string
	var args []interface{}

	if filter.EnterpriseID != "" {
		conditions = append(conditions, "r.enterprise_id = ?")
		args = append(args, filter.EnterpriseID)
	}
	if filter.ProblemType != "" {
		conditions = append(conditions, "r.problem_type = ?")
		args = append(args, filter.ProblemType)
	}
	if filter.Status != "" {
		conditions = append(conditions, "r.status = ?")
		args = append(args, filter.Status)
	}
	if filter.DeadlineFrom != "" {
		conditions = append(conditions, "r.deadline >= ?")
		args = append(args, filter.DeadlineFrom)
	}
	if filter.DeadlineTo != "" {
		conditions = append(conditions, "r.deadline <= ?")
		args = append(args, filter.DeadlineTo)
	}
	if filter.Keyword != "" {
		conditions = append(conditions, "(r.problem_desc LIKE ? OR r.responsible_person LIKE ? OR e.name LIKE ?)")
		kw := "%" + filter.Keyword + "%"
		args = append(args, kw, kw, kw)
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM rectifications r LEFT JOIN enterprises e ON r.enterprise_id = e.id %s", where)
	if err := database.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("统计整改事项数量失败: %w", err)
	}

	offset := (filter.Page - 1) * filter.PageSize
	querySQL := fmt.Sprintf(`
		SELECT r.id, r.enterprise_id, e.name, r.problem_type, r.problem_desc, r.deadline, r.responsible_person, r.acceptance_criteria, r.status, r.inspector_round, r.created_at, r.updated_at
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		%s ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`, where)

	queryArgs := append(args, filter.PageSize, offset)
	rows, err := database.DB.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("查询整改事项列表失败: %w", err)
	}
	defer rows.Close()

	var items []Rectification
	for rows.Next() {
		var r Rectification
		if err := rows.Scan(&r.ID, &r.EnterpriseID, &r.EnterpriseName, &r.ProblemType, &r.ProblemDesc, &r.Deadline, &r.ResponsiblePerson, &r.AcceptanceCriteria, &r.Status, &r.InspectorRound, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("扫描整改事项数据失败: %w", err)
		}
		items = append(items, r)
	}

	if items == nil {
		items = []Rectification{}
	}

	return &RectListResult{
		Items:    items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (t *Tracker) SubmitProgress(report *ProgressReport) error {
	if report.ID == "" {
		report.ID = "JC" + uuid.New().String()[:8]
	}
	if report.RectificationID == "" {
		return fmt.Errorf("整改事项ID不能为空")
	}
	if report.Content == "" {
		return fmt.Errorf("汇报内容不能为空")
	}
	if report.ReportType == "" {
		report.ReportType = "企业汇报"
	}
	report.CreatedAt = time.Now().Format("2006-01-02 15:04:05")

	_, err := database.DB.Exec(`
		INSERT INTO progress_reports (id, rectification_id, report_type, content, attachment, reviewer, review_comment, reviewed_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		report.ID, report.RectificationID, report.ReportType, report.Content, report.Attachment, report.Reviewer, report.ReviewComment, report.ReviewedAt, report.CreatedAt)

	if err != nil {
		logger.Error("提交整改进度失败", map[string]string{"error": err.Error(), "target": report.RectificationID})
		return fmt.Errorf("提交整改进度失败: %w", err)
	}

	if report.ReportType == "企业汇报" {
		_ = t.UpdateStatus(report.RectificationID, StatusInProgress, "system")
	}

	logger.LogAction("system", "提交整改进度", report.RectificationID, "成功")
	return nil
}

func (t *Tracker) ReviewProgress(reportID string, reviewer, comment string, approved bool) error {
	var rectID string
	var reviewedAt interface{}
	err := database.DB.QueryRow(`
		SELECT rectification_id FROM progress_reports WHERE id = ?`, reportID).Scan(&rectID)
	if err != nil {
		return fmt.Errorf("进度汇报不存在: %s", reportID)
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	reviewedAt = now

	_, err = database.DB.Exec(`
		UPDATE progress_reports SET reviewer=?, review_comment=?, reviewed_at=? WHERE id=?`,
		reviewer, comment, reviewedAt, reportID)
	if err != nil {
		return fmt.Errorf("审核进度汇报失败: %w", err)
	}

	if approved {
		_ = t.UpdateStatus(rectID, StatusReview, reviewer)
	} else {
		_ = t.UpdateStatus(rectID, StatusInProgress, reviewer)
	}

	logger.LogAction(reviewer, "审核整改进度", reportID, fmt.Sprintf("审核结果:%v", approved))
	return nil
}

func (t *Tracker) ListProgress(rectID string) ([]ProgressReport, error) {
	rows, err := database.DB.Query(`
		SELECT id, rectification_id, report_type, content, attachment, reviewer, review_comment, COALESCE(reviewed_at, ''), created_at
		FROM progress_reports WHERE rectification_id = ? ORDER BY created_at ASC`, rectID)
	if err != nil {
		return nil, fmt.Errorf("查询进度汇报失败: %w", err)
	}
	defer rows.Close()

	var reports []ProgressReport
	for rows.Next() {
		var r ProgressReport
		if err := rows.Scan(&r.ID, &r.RectificationID, &r.ReportType, &r.Content, &r.Attachment, &r.Reviewer, &r.ReviewComment, &r.ReviewedAt, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("扫描进度数据失败: %w", err)
		}
		reports = append(reports, r)
	}

	if reports == nil {
		reports = []ProgressReport{}
	}
	return reports, nil
}

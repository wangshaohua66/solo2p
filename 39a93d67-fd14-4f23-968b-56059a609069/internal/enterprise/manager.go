package enterprise

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"eco-inspector/internal/database"
	"eco-inspector/pkg/logger"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

type Enterprise struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Region         string `json:"region"`
	Industry       string `json:"industry"`
	RiskLevel      string `json:"risk_level"`
	Address        string `json:"address"`
	Contact        string `json:"contact"`
	Phone          string `json:"phone"`
	CreditScore    int    `json:"credit_score"`
	InspectedCount int    `json:"inspected_count"`
	Remark         string `json:"remark"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type InspectorHistory struct {
	ID                string `json:"id"`
	EnterpriseID      string `json:"enterprise_id"`
	InspectorRound    string `json:"inspector_round"`
	InspectionDate    string `json:"inspection_date"`
	Inspector         string `json:"inspector"`
	ProblemSummary    string `json:"problem_summary"`
	RectificationCount int   `json:"rectification_count"`
	Result            string `json:"result"`
	Remark            string `json:"remark"`
	CreatedAt         string `json:"created_at"`
}

type Manager struct{}

func NewManager() *Manager {
	return &Manager{}
}

var codePattern = regexp.MustCompile(`^[A-Z]{2}\d{6}$`)

func ValidateCode(code string) error {
	if !codePattern.MatchString(code) {
		return fmt.Errorf("企业编码格式错误，应为2位大写字母+6位数字，如: EP000001")
	}
	return nil
}

func (m *Manager) Create(e *Enterprise) error {
	if e.ID == "" {
		e.ID = generateEnterpriseCode()
	}
	if err := ValidateCode(e.ID); err != nil {
		return err
	}
	if e.Name == "" {
		return fmt.Errorf("企业名称不能为空")
	}
	if e.RiskLevel == "" {
		e.RiskLevel = "中"
	}
	if !isValidRiskLevel(e.RiskLevel) {
		return fmt.Errorf("风险等级无效，应为: 高、中、低")
	}
	if e.CreditScore == 0 {
		e.CreditScore = 100
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	e.CreatedAt = now
	e.UpdatedAt = now

	_, err := database.DB.Exec(`
		INSERT INTO enterprises (id, name, region, industry, risk_level, address, contact, phone, credit_score, inspected_count, remark, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID, e.Name, e.Region, e.Industry, e.RiskLevel, e.Address, e.Contact, e.Phone, e.CreditScore, e.InspectedCount, e.Remark, e.CreatedAt, e.UpdatedAt)

	if err != nil {
		logger.Error("创建企业失败", map[string]string{"error": err.Error(), "target": e.ID})
		return fmt.Errorf("创建企业失败: %w", err)
	}

	logger.LogAction("system", "创建企业", e.ID, "成功")
	return nil
}

func (m *Manager) GetByID(id string) (*Enterprise, error) {
	e := &Enterprise{}
	err := database.DB.QueryRow(`
		SELECT id, name, region, industry, risk_level, address, contact, phone, credit_score, inspected_count, remark, created_at, updated_at
		FROM enterprises WHERE id = ?`, id).
		Scan(&e.ID, &e.Name, &e.Region, &e.Industry, &e.RiskLevel, &e.Address, &e.Contact, &e.Phone, &e.CreditScore, &e.InspectedCount, &e.Remark, &e.CreatedAt, &e.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("企业不存在: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("查询企业失败: %w", err)
	}
	return e, nil
}

func (m *Manager) Update(e *Enterprise) error {
	if e.RiskLevel != "" && !isValidRiskLevel(e.RiskLevel) {
		return fmt.Errorf("风险等级无效，应为: 高、中、低")
	}
	e.UpdatedAt = time.Now().Format("2006-01-02 15:04:05")

	result, err := database.DB.Exec(`
		UPDATE enterprises SET name=?, region=?, industry=?, risk_level=?, address=?, contact=?, phone=?, credit_score=?, inspected_count=?, remark=?, updated_at=?
		WHERE id=?`,
		e.Name, e.Region, e.Industry, e.RiskLevel, e.Address, e.Contact, e.Phone, e.CreditScore, e.InspectedCount, e.Remark, e.UpdatedAt, e.ID)

	if err != nil {
		return fmt.Errorf("更新企业失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("企业不存在: %s", e.ID)
	}

	logger.LogAction("system", "更新企业", e.ID, "成功")
	return nil
}

func (m *Manager) Delete(id string) error {
	result, err := database.DB.Exec("DELETE FROM enterprises WHERE id=?", id)
	if err != nil {
		return fmt.Errorf("删除企业失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("企业不存在: %s", id)
	}

	logger.LogAction("system", "删除企业", id, "成功")
	return nil
}

type ListFilter struct {
	Region   string
	Industry string
	Risk     string
	Keyword  string
	Page     int
	PageSize int
}

type ListResult struct {
	Enterprises []Enterprise `json:"enterprises"`
	Total       int          `json:"total"`
	Page        int          `json:"page"`
	PageSize    int          `json:"page_size"`
}

func (m *Manager) List(filter ListFilter) (*ListResult, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}

	var conditions []string
	var args []interface{}

	if filter.Region != "" {
		conditions = append(conditions, "region = ?")
		args = append(args, filter.Region)
	}
	if filter.Industry != "" {
		conditions = append(conditions, "industry = ?")
		args = append(args, filter.Industry)
	}
	if filter.Risk != "" {
		conditions = append(conditions, "risk_level = ?")
		args = append(args, filter.Risk)
	}
	if filter.Keyword != "" {
		conditions = append(conditions, "(name LIKE ? OR id LIKE ? OR address LIKE ?)")
		kw := "%" + filter.Keyword + "%"
		args = append(args, kw, kw, kw)
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM enterprises %s", where)
	if err := database.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("统计企业数量失败: %w", err)
	}

	offset := (filter.Page - 1) * filter.PageSize
	querySQL := fmt.Sprintf(`
		SELECT id, name, region, industry, risk_level, address, contact, phone, credit_score, inspected_count, remark, created_at, updated_at
		FROM enterprises %s ORDER BY updated_at DESC LIMIT ? OFFSET ?`, where)

	queryArgs := append(args, filter.PageSize, offset)
	rows, err := database.DB.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("查询企业列表失败: %w", err)
	}
	defer rows.Close()

	var enterprises []Enterprise
	for rows.Next() {
		var e Enterprise
		if err := rows.Scan(&e.ID, &e.Name, &e.Region, &e.Industry, &e.RiskLevel, &e.Address, &e.Contact, &e.Phone, &e.CreditScore, &e.InspectedCount, &e.Remark, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("扫描企业数据失败: %w", err)
		}
		enterprises = append(enterprises, e)
	}

	if enterprises == nil {
		enterprises = []Enterprise{}
	}

	return &ListResult{
		Enterprises: enterprises,
		Total:       total,
		Page:        filter.Page,
		PageSize:    filter.PageSize,
	}, nil
}

type ProgressFn func(current, total int)

func (m *Manager) ImportFromCSV(filePath string, progressFn ProgressFn) (int, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return 0, fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		return 0, fmt.Errorf("读取CSV头失败: %w", err)
	}

	colMap := make(map[string]int)
	for i, h := range header {
		colMap[strings.TrimSpace(h)] = i
	}

	required := []string{"企业名称"}
	for _, r := range required {
		if _, ok := colMap[r]; !ok {
			return 0, fmt.Errorf("CSV缺少必要列: %s", r)
		}
	}

	var records [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		records = append(records, record)
	}

	return m.importRecords(records, colMap, filePath, progressFn)
}

func (m *Manager) ImportFromExcel(filePath string, progressFn ProgressFn) (int, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("打开Excel文件失败: %w", err)
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return 0, fmt.Errorf("读取Excel行失败: %w", err)
	}

	if len(rows) < 2 {
		return 0, fmt.Errorf("Excel文件为空或无数据行")
	}

	header := rows[0]
	colMap := make(map[string]int)
	for i, h := range header {
		colMap[strings.TrimSpace(h)] = i
	}

	required := []string{"企业名称"}
	for _, r := range required {
		if _, ok := colMap[r]; !ok {
			return 0, fmt.Errorf("Excel缺少必要列: %s", r)
		}
	}

	return m.importRecords(rows[1:], colMap, filePath, progressFn)
}

func (m *Manager) importRecords(records [][]string, colMap map[string]int, filePath string, progressFn ProgressFn) (int, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return 0, fmt.Errorf("开启事务失败: %w", err)
	}

	count := 0
	now := time.Now().Format("2006-01-02 15:04:05")
	total := len(records)

	for idx, record := range records {
		name := getColValue(record, colMap, "企业名称")
		if name == "" {
			continue
		}

		id := getColValue(record, colMap, "企业编码")
		if id == "" {
			id = generateEnterpriseCode()
		}

		region := getColValue(record, colMap, "区域")
		industry := getColValue(record, colMap, "行业")
		riskLevel := getColValue(record, colMap, "风险等级")
		if riskLevel == "" {
			riskLevel = "中"
		}
		address := getColValue(record, colMap, "地址")
		contact := getColValue(record, colMap, "联系人")
		phone := getColValue(record, colMap, "联系电话")

		_, err = tx.Exec(`
			INSERT OR REPLACE INTO enterprises (id, name, region, industry, risk_level, address, contact, phone, credit_score, inspected_count, remark, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100, 0, '', ?, ?)`,
			id, name, region, industry, riskLevel, address, contact, phone, now, now)
		if err != nil {
			continue
		}
		count++

		if progressFn != nil {
			progressFn(idx+1, total)
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("提交事务失败: %w", err)
	}

	logger.LogAction("system", "批量导入企业", filePath, fmt.Sprintf("导入%d条", count))
	return count, nil
}

func (m *Manager) ImportAutoDetect(filePath string, progressFn ProgressFn) (int, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".xlsx", ".xls":
		return m.ImportFromExcel(filePath, progressFn)
	case ".csv":
		return m.ImportFromCSV(filePath, progressFn)
	default:
		return 0, fmt.Errorf("不支持的文件格式: %s，支持 .csv 和 .xlsx", ext)
	}
}

func (m *Manager) ExportToCSV(filePath string, filter ListFilter) (int, error) {
	result, err := m.List(ListFilter{
		Region:   filter.Region,
		Industry: filter.Industry,
		Risk:     filter.Risk,
		Keyword:  filter.Keyword,
		Page:     1,
		PageSize: 10000,
	})
	if err != nil {
		return 0, fmt.Errorf("查询企业数据失败: %w", err)
	}

	f, err := os.Create(filePath)
	if err != nil {
		return 0, fmt.Errorf("创建文件失败: %w", err)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	defer writer.Flush()

	header := []string{"企业编码", "企业名称", "区域", "行业", "风险等级", "地址", "联系人", "联系电话", "信用分", "督察次数", "备注"}
	if err := writer.Write(header); err != nil {
		return 0, fmt.Errorf("写入CSV头失败: %w", err)
	}

	for _, e := range result.Enterprises {
		record := []string{e.ID, e.Name, e.Region, e.Industry, e.RiskLevel, e.Address, e.Contact, e.Phone, fmt.Sprintf("%d", e.CreditScore), fmt.Sprintf("%d", e.InspectedCount), e.Remark}
		if err := writer.Write(record); err != nil {
			return 0, fmt.Errorf("写入CSV行失败: %w", err)
		}
	}

	logger.LogAction("system", "导出企业数据", filePath, fmt.Sprintf("导出%d条", result.Total))
	return result.Total, nil
}

func (m *Manager) AddHistory(h *InspectorHistory) error {
	if h.ID == "" {
		h.ID = "IH" + uuid.New().String()[:8]
	}
	if h.EnterpriseID == "" {
		return fmt.Errorf("企业ID不能为空")
	}
	if h.InspectionDate == "" {
		return fmt.Errorf("督察日期不能为空")
	}
	h.CreatedAt = time.Now().Format("2006-01-02 15:04:05")

	_, err := database.DB.Exec(`
		INSERT INTO inspector_history (id, enterprise_id, inspector_round, inspection_date, inspector, problem_summary, rectification_count, result, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.EnterpriseID, h.InspectorRound, h.InspectionDate, h.Inspector, h.ProblemSummary, h.RectificationCount, h.Result, h.Remark, h.CreatedAt)
	if err != nil {
		return fmt.Errorf("添加督察历史失败: %w", err)
	}

	_, _ = database.DB.Exec(`
		UPDATE enterprises SET inspected_count = inspected_count + 1, updated_at = ? WHERE id = ?`,
		time.Now().Format("2006-01-02 15:04:05"), h.EnterpriseID)

	logger.LogAction("system", "添加督察历史", h.EnterpriseID, h.InspectorRound)
	return nil
}

func (m *Manager) GetHistory(id string) (*InspectorHistory, error) {
	h := &InspectorHistory{}
	err := database.DB.QueryRow(`
		SELECT id, enterprise_id, inspector_round, inspection_date, inspector, problem_summary, rectification_count, result, remark, created_at
		FROM inspector_history WHERE id = ?`, id).
		Scan(&h.ID, &h.EnterpriseID, &h.InspectorRound, &h.InspectionDate, &h.Inspector, &h.ProblemSummary, &h.RectificationCount, &h.Result, &h.Remark, &h.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("督察历史不存在: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("查询督察历史失败: %w", err)
	}
	return h, nil
}

func (m *Manager) ListHistory(enterpriseID string, page, pageSize int) ([]InspectorHistory, int, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	var total int
	err := database.DB.QueryRow(`
		SELECT COUNT(*) FROM inspector_history WHERE enterprise_id = ?`, enterpriseID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("统计督察历史数量失败: %w", err)
	}

	offset := (page - 1) * pageSize
	rows, err := database.DB.Query(`
		SELECT id, enterprise_id, inspector_round, inspection_date, inspector, problem_summary, rectification_count, result, remark, created_at
		FROM inspector_history WHERE enterprise_id = ?
		ORDER BY inspection_date DESC LIMIT ? OFFSET ?`, enterpriseID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("查询督察历史失败: %w", err)
	}
	defer rows.Close()

	var history []InspectorHistory
	for rows.Next() {
		var h InspectorHistory
		if err := rows.Scan(&h.ID, &h.EnterpriseID, &h.InspectorRound, &h.InspectionDate, &h.Inspector, &h.ProblemSummary, &h.RectificationCount, &h.Result, &h.Remark, &h.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("扫描督察历史数据失败: %w", err)
		}
		history = append(history, h)
	}

	if history == nil {
		history = []InspectorHistory{}
	}
	return history, total, nil
}

func (m *Manager) UpdateHistory(h *InspectorHistory) error {
	if h.ID == "" {
		return fmt.Errorf("历史记录ID不能为空")
	}

	result, err := database.DB.Exec(`
		UPDATE inspector_history SET inspector_round=?, inspection_date=?, inspector=?, problem_summary=?, rectification_count=?, result=?, remark=?
		WHERE id=?`,
		h.InspectorRound, h.InspectionDate, h.Inspector, h.ProblemSummary, h.RectificationCount, h.Result, h.Remark, h.ID)
	if err != nil {
		return fmt.Errorf("更新督察历史失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("督察历史不存在: %s", h.ID)
	}

	logger.LogAction("system", "更新督察历史", h.ID, "成功")
	return nil
}

func (m *Manager) DeleteHistory(id string) error {
	result, err := database.DB.Exec("DELETE FROM inspector_history WHERE id=?", id)
	if err != nil {
		return fmt.Errorf("删除督察历史失败: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("督察历史不存在: %s", id)
	}

	logger.LogAction("system", "删除督察历史", id, "成功")
	return nil
}

func generateEnterpriseCode() string {
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM enterprises").Scan(&count)
	return fmt.Sprintf("EP%06d", count+1)
}

func isValidRiskLevel(level string) bool {
	return level == "高" || level == "中" || level == "低"
}

func getColValue(record []string, colMap map[string]int, col string) string {
	idx, ok := colMap[col]
	if !ok || idx >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[idx])
}

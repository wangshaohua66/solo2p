package archive

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"eco-inspector/internal/database"
	"eco-inspector/internal/inspector"
	"eco-inspector/pkg/logger"

	"github.com/google/uuid"
)

const (
	MaterialsDir = "data/archive_materials"
)

type MaterialMeta struct {
	ID         string `json:"id"`
	FileName   string `json:"file_name"`
	StoredName string `json:"stored_name"`
	FilePath   string `json:"file_path"`
	FileType   string `json:"file_type"`
	FileSize   int64  `json:"file_size"`
	UploadTime string `json:"upload_time"`
	Uploader   string `json:"uploader"`
}

type Archive struct {
	ID               string `json:"id"`
	RectificationID  string `json:"rectification_id"`
	EnterpriseID     string `json:"enterprise_id"`
	EnterpriseName   string `json:"enterprise_name,omitempty"`
	AcceptanceResult string `json:"acceptance_result"`
	AcceptanceDate   string `json:"acceptance_date"`
	AcceptancePerson string `json:"acceptance_person"`
	Materials        string `json:"materials"`
	Remark           string `json:"remark"`
	CreatedAt        string `json:"created_at"`
}

type ArchiveFilter struct {
	EnterpriseID string
	ProblemType  string
	DateFrom     string
	DateTo       string
	Status       string
	Keyword      string
	Page         int
	PageSize     int
}

type ArchiveListResult struct {
	Items    []Archive `json:"items"`
	Total    int       `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
}

type Archiver struct {
	tracker *inspector.Tracker
}

func NewArchiver() *Archiver {
	return &Archiver{
		tracker: inspector.NewTracker(),
	}
}

func (a *Archiver) Create(arc *Archive) error {
	if arc.ID == "" {
		arc.ID = "DA" + uuid.New().String()[:8]
	}
	if arc.RectificationID == "" {
		return fmt.Errorf("整改事项ID不能为空")
	}
	if arc.AcceptanceResult == "" {
		return fmt.Errorf("验收结论不能为空")
	}
	if arc.AcceptanceDate == "" {
		return fmt.Errorf("验收日期不能为空")
	}
	if arc.AcceptancePerson == "" {
		return fmt.Errorf("验收人不能为空")
	}

	rect, err := a.tracker.GetByID(arc.RectificationID)
	if err != nil {
		return fmt.Errorf("查询整改事项失败: %w", err)
	}
	if rect.Status != string(inspector.StatusReview) {
		return fmt.Errorf("整改事项状态不是'待验收'，无法销号")
	}

	arc.EnterpriseID = rect.EnterpriseID
	arc.CreatedAt = time.Now().Format("2006-01-02 15:04:05")

	_, err = database.DB.Exec(`
		INSERT INTO archives (id, rectification_id, enterprise_id, acceptance_result, acceptance_date, acceptance_person, materials, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		arc.ID, arc.RectificationID, arc.EnterpriseID, arc.AcceptanceResult, arc.AcceptanceDate, arc.AcceptancePerson, arc.Materials, arc.Remark, arc.CreatedAt)

	if err != nil {
		logger.Error("创建验收档案失败", map[string]string{"error": err.Error(), "target": arc.RectificationID})
		return fmt.Errorf("创建验收档案失败: %w", err)
	}

	if arc.AcceptanceResult == "合格" || arc.AcceptanceResult == "通过" {
		_ = a.tracker.UpdateStatus(arc.RectificationID, inspector.StatusClosed, arc.AcceptancePerson)

		_, _ = database.DB.Exec(`
			UPDATE enterprises SET credit_score = credit_score + 5 WHERE id = ?`, arc.EnterpriseID)
	} else {
		_, _ = database.DB.Exec(`
			UPDATE enterprises SET credit_score = CASE WHEN credit_score - 10 < 0 THEN 0 ELSE credit_score - 10 END WHERE id = ?`, arc.EnterpriseID)
	}

	logger.LogAction(arc.AcceptancePerson, "验收销号", arc.RectificationID, arc.AcceptanceResult)
	return nil
}

func (a *Archiver) GetByID(id string) (*Archive, error) {
	arc := &Archive{}
	err := database.DB.QueryRow(`
		SELECT ar.id, ar.rectification_id, ar.enterprise_id, e.name, ar.acceptance_result, ar.acceptance_date, ar.acceptance_person, ar.materials, ar.remark, ar.created_at
		FROM archives ar
		LEFT JOIN enterprises e ON ar.enterprise_id = e.id
		WHERE ar.id = ?`, id).
		Scan(&arc.ID, &arc.RectificationID, &arc.EnterpriseID, &arc.EnterpriseName, &arc.AcceptanceResult, &arc.AcceptanceDate, &arc.AcceptancePerson, &arc.Materials, &arc.Remark, &arc.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("档案不存在: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("查询档案失败: %w", err)
	}
	return arc, nil
}

func (a *Archiver) List(filter ArchiveFilter) (*ArchiveListResult, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}

	var conditions []string
	var args []interface{}

	if filter.EnterpriseID != "" {
		conditions = append(conditions, "ar.enterprise_id = ?")
		args = append(args, filter.EnterpriseID)
	}
	if filter.DateFrom != "" {
		conditions = append(conditions, "ar.acceptance_date >= ?")
		args = append(args, filter.DateFrom)
	}
	if filter.DateTo != "" {
		conditions = append(conditions, "ar.acceptance_date <= ?")
		args = append(args, filter.DateTo)
	}
	if filter.Status != "" {
		conditions = append(conditions, "ar.acceptance_result = ?")
		args = append(args, filter.Status)
	}
	if filter.ProblemType != "" {
		conditions = append(conditions, "r.problem_type = ?")
		args = append(args, filter.ProblemType)
	}
	if filter.Keyword != "" {
		conditions = append(conditions, "(ar.materials LIKE ? OR ar.remark LIKE ? OR e.name LIKE ? OR r.problem_desc LIKE ?)")
		kw := "%" + filter.Keyword + "%"
		args = append(args, kw, kw, kw, kw)
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countSQL := fmt.Sprintf(`
		SELECT COUNT(*) FROM archives ar
		LEFT JOIN enterprises e ON ar.enterprise_id = e.id
		LEFT JOIN rectifications r ON ar.rectification_id = r.id
		%s`, where)
	if err := database.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("统计档案数量失败: %w", err)
	}

	offset := (filter.Page - 1) * filter.PageSize
	querySQL := fmt.Sprintf(`
		SELECT ar.id, ar.rectification_id, ar.enterprise_id, e.name, ar.acceptance_result, ar.acceptance_date, ar.acceptance_person, ar.materials, ar.remark, ar.created_at
		FROM archives ar
		LEFT JOIN enterprises e ON ar.enterprise_id = e.id
		LEFT JOIN rectifications r ON ar.rectification_id = r.id
		%s ORDER BY ar.created_at DESC LIMIT ? OFFSET ?`, where)

	queryArgs := append(args, filter.PageSize, offset)
	rows, err := database.DB.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("查询档案列表失败: %w", err)
	}
	defer rows.Close()

	var items []Archive
	for rows.Next() {
		var arc Archive
		if err := rows.Scan(&arc.ID, &arc.RectificationID, &arc.EnterpriseID, &arc.EnterpriseName, &arc.AcceptanceResult, &arc.AcceptanceDate, &arc.AcceptancePerson, &arc.Materials, &arc.Remark, &arc.CreatedAt); err != nil {
			return nil, fmt.Errorf("扫描档案数据失败: %w", err)
		}
		items = append(items, arc)
	}

	if items == nil {
		items = []Archive{}
	}

	return &ArchiveListResult{
		Items:    items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (a *Archiver) FullTextSearch(keyword string, page, pageSize int) (*ArchiveListResult, error) {
	if keyword == "" {
		return nil, fmt.Errorf("搜索关键词不能为空")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	kw := "%" + keyword + "%"

	var total int
	err := database.DB.QueryRow(`
		SELECT COUNT(*) FROM archives ar
		LEFT JOIN enterprises e ON ar.enterprise_id = e.id
		LEFT JOIN rectifications r ON ar.rectification_id = r.id
		WHERE ar.materials LIKE ? OR ar.remark LIKE ? OR e.name LIKE ? OR r.problem_desc LIKE ?`,
		kw, kw, kw, kw).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("搜索档案数量失败: %w", err)
	}

	offset := (page - 1) * pageSize
	rows, err := database.DB.Query(`
		SELECT ar.id, ar.rectification_id, ar.enterprise_id, e.name, ar.acceptance_result, ar.acceptance_date, ar.acceptance_person, ar.materials, ar.remark, ar.created_at
		FROM archives ar
		LEFT JOIN enterprises e ON ar.enterprise_id = e.id
		LEFT JOIN rectifications r ON ar.rectification_id = r.id
		WHERE ar.materials LIKE ? OR ar.remark LIKE ? OR e.name LIKE ? OR r.problem_desc LIKE ?
		ORDER BY ar.created_at DESC LIMIT ? OFFSET ?`,
		kw, kw, kw, kw, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("搜索档案失败: %w", err)
	}
	defer rows.Close()

	var items []Archive
	for rows.Next() {
		var arc Archive
		if err := rows.Scan(&arc.ID, &arc.RectificationID, &arc.EnterpriseID, &arc.EnterpriseName, &arc.AcceptanceResult, &arc.AcceptanceDate, &arc.AcceptancePerson, &arc.Materials, &arc.Remark, &arc.CreatedAt); err != nil {
			continue
		}
		items = append(items, arc)
	}

	if items == nil {
		items = []Archive{}
	}

	return &ArchiveListResult{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func ensureMaterialsDir() error {
	if err := os.MkdirAll(MaterialsDir, 0755); err != nil {
		return fmt.Errorf("创建材料目录失败: %w", err)
	}
	return nil
}

func (a *Archiver) UploadMaterial(archiveID string, sourcePath, uploader string) (*MaterialMeta, error) {
	if archiveID == "" {
		return nil, fmt.Errorf("档案ID不能为空")
	}
	if sourcePath == "" {
		return nil, fmt.Errorf("源文件路径不能为空")
	}

	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("源文件不存在: %s", sourcePath)
	}

	if err := ensureMaterialsDir(); err != nil {
		return nil, err
	}

	archiveDir := filepath.Join(MaterialsDir, archiveID)
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return nil, fmt.Errorf("创建档案目录失败: %w", err)
	}

	metaID := "MT" + uuid.New().String()[:8]
	originalName := filepath.Base(sourcePath)
	ext := filepath.Ext(originalName)
	storedName := metaID + ext
	destPath := filepath.Join(archiveDir, storedName)

	srcFile, err := os.Open(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("打开源文件失败: %w", err)
	}
	defer srcFile.Close()

	dstFile, err := os.Create(destPath)
	if err != nil {
		return nil, fmt.Errorf("创建目标文件失败: %w", err)
	}
	defer dstFile.Close()

	n, err := io.Copy(dstFile, srcFile)
	if err != nil {
		return nil, fmt.Errorf("复制文件失败: %w", err)
	}

	fileType := getFileType(ext)

	meta := &MaterialMeta{
		ID:         metaID,
		FileName:   originalName,
		StoredName: storedName,
		FilePath:   destPath,
		FileType:   fileType,
		FileSize:   n,
		UploadTime: time.Now().Format("2006-01-02 15:04:05"),
		Uploader:   uploader,
	}

	arc, err := a.GetByID(archiveID)
	if err != nil {
		return nil, err
	}

	var materials []MaterialMeta
	if arc.Materials != "" {
		_ = json.Unmarshal([]byte(arc.Materials), &materials)
	}
	materials = append(materials, *meta)

	metaJSON, _ := json.Marshal(materials)
	_, err = database.DB.Exec("UPDATE archives SET materials = ? WHERE id = ?", string(metaJSON), archiveID)
	if err != nil {
		return nil, fmt.Errorf("更新档案材料失败: %w", err)
	}

	logger.LogAction(uploader, "上传验收材料", archiveID, originalName)
	return meta, nil
}

func (a *Archiver) ListMaterials(archiveID string) ([]MaterialMeta, error) {
	arc, err := a.GetByID(archiveID)
	if err != nil {
		return nil, err
	}
	if arc.Materials == "" {
		return []MaterialMeta{}, nil
	}
	var materials []MaterialMeta
	if err := json.Unmarshal([]byte(arc.Materials), &materials); err != nil {
		return nil, fmt.Errorf("解析材料元数据失败: %w", err)
	}
	return materials, nil
}

func (a *Archiver) GetMaterial(archiveID, materialID string) (*MaterialMeta, error) {
	materials, err := a.ListMaterials(archiveID)
	if err != nil {
		return nil, err
	}
	for i := range materials {
		if materials[i].ID == materialID {
			return &materials[i], nil
		}
	}
	return nil, fmt.Errorf("材料不存在: %s", materialID)
}

func (a *Archiver) DeleteMaterial(archiveID, materialID, operator string) error {
	arc, err := a.GetByID(archiveID)
	if err != nil {
		return err
	}

	var materials []MaterialMeta
	if arc.Materials != "" {
		_ = json.Unmarshal([]byte(arc.Materials), &materials)
	}

	found := false
	var remaining []MaterialMeta
	var toDeletePath string
	for _, m := range materials {
		if m.ID == materialID {
			found = true
			toDeletePath = m.FilePath
		} else {
			remaining = append(remaining, m)
		}
	}
	if !found {
		return fmt.Errorf("材料不存在: %s", materialID)
	}

	metaJSON, _ := json.Marshal(remaining)
	_, err = database.DB.Exec("UPDATE archives SET materials = ? WHERE id = ?", string(metaJSON), archiveID)
	if err != nil {
		return fmt.Errorf("更新档案材料失败: %w", err)
	}

	if toDeletePath != "" {
		_ = os.Remove(toDeletePath)
	}

	logger.LogAction(operator, "删除验收材料", archiveID, materialID)
	return nil
}

func getFileType(ext string) string {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp":
		return "image"
	case ".pdf":
		return "pdf"
	case ".doc", ".docx":
		return "word"
	case ".xls", ".xlsx":
		return "excel"
	case ".txt":
		return "text"
	case ".zip", ".rar", ".7z":
		return "archive"
	default:
		return "other"
	}
}

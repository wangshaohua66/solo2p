package notifier

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"copyright-monitor/internal/models"
	"copyright-monitor/internal/storage"

	"go.uber.org/zap"
)

type Notifier struct {
	logger *zap.Logger
}

var globalNotifier *Notifier

func NewNotifier(logger *zap.Logger) *Notifier {
	return &Notifier{
		logger: logger,
	}
}

func Init(logger *zap.Logger) {
	globalNotifier = NewNotifier(logger)
}

func Global() *Notifier {
	return globalNotifier
}

func (n *Notifier) ExportCluesToCSV(clues []*models.InfringementClue, outputPath string) (string, error) {
	if len(clues) == 0 {
		return "", fmt.Errorf("no clues to export")
	}

	if outputPath == "" {
		batchNo := generateBatchNo()
		outputPath = filepath.Join("data", fmt.Sprintf("infringement_batch_%s.csv", batchNo))
	}

	dir := filepath.Dir(outputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{
		"线索ID", "作品名称", "作品类型", "权利人", "联系方式",
		"登记号", "侵权平台", "侵权URL", "侵权标题", "相似度(%)",
		"发现时间", "证据ID", "证据文件路径", "状态",
	}
	if err := writer.Write(header); err != nil {
		return "", err
	}

	batchNo := generateBatchNo()
	for _, clue := range clues {
		evidencePath := ""
		if clue.EvidenceID > 0 {
			evidencePath = filepath.Join("data", "evidence", fmt.Sprintf("evidence_%d_*.json", clue.ID))
		}

		row := []string{
			strconv.FormatInt(clue.ID, 10),
			clue.WorkTitle,
			string(clue.WorkType),
			clue.Owner,
			clue.OwnerContact,
			clue.RegistrationNo,
			clue.PlatformName,
			clue.InfringementURL,
			clue.InfringementTitle,
			fmt.Sprintf("%.2f", clue.Similarity),
			clue.DiscoverTime.Format("2006-01-02 15:04:05"),
			strconv.FormatInt(clue.EvidenceID, 10),
			evidencePath,
			clue.Status,
		}
		if err := writer.Write(row); err != nil {
			return "", err
		}

		clue.ReportBatchNo = batchNo
		clue.Status = "exported"
		storage.Global().AddClue(clue)
	}

	n.logger.Info("Clues exported to CSV",
		zap.Int("count", len(clues)),
		zap.String("path", outputPath),
		zap.String("batch", batchNo),
	)

	return outputPath, nil
}

func (n *Notifier) ExportPendingClues() (string, error) {
	clues, err := storage.Global().GetPendingClues()
	if err != nil {
		return "", err
	}

	return n.ExportCluesToCSV(clues, "")
}

func (n *Notifier) GenerateReport(start, end time.Time) (*models.EvidenceReport, string, error) {
	clues, err := storage.Global().GetCluesByTimeRange(start, end)
	if err != nil {
		return nil, "", err
	}

	report := &models.EvidenceReport{
		ReportID:    generateReportID(),
		GeneratedAt: time.Now(),
		ClueCount:   len(clues),
		Clues:       clues,
	}

	outputPath := filepath.Join(
		"data",
		fmt.Sprintf("report_%s_%s.csv",
			start.Format("20060102"),
			end.Format("20060102"),
		),
	)

	if len(clues) == 0 {
		if err := createEmptyCSV(outputPath); err != nil {
			return nil, "", err
		}
	} else {
		_, err = n.ExportCluesToCSV(clues, outputPath)
		if err != nil {
			return nil, "", err
		}
	}

	n.logger.Info("Report generated",
		zap.String("report_id", report.ReportID),
		zap.Int("clue_count", len(clues)),
		zap.String("path", outputPath),
	)

	return report, outputPath, nil
}

func (n *Notifier) NotifyLawEnforcement(clues []*models.InfringementClue) error {
	if len(clues) == 0 {
		return nil
	}

	batchNo := generateBatchNo()

	csvPath, err := n.ExportCluesToCSV(clues, "")
	if err != nil {
		return err
	}

	n.logger.Info("Notifying law enforcement",
		zap.String("batch_no", batchNo),
		zap.Int("clue_count", len(clues)),
		zap.String("csv_path", csvPath),
	)

	for _, clue := range clues {
		n.logger.Debug("Clue details",
			zap.Int64("clue_id", clue.ID),
			zap.String("work", clue.WorkTitle),
			zap.String("platform", clue.PlatformName),
			zap.String("url", clue.InfringementURL),
		)
	}

	return nil
}

func (n *Notifier) SendAlert(clue *models.InfringementClue) error {
	n.logger.Warn("INFRINGEMENT ALERT",
		zap.String("work", clue.WorkTitle),
		zap.String("owner", clue.Owner),
		zap.String("platform", clue.PlatformName),
		zap.Float64("similarity", clue.Similarity),
		zap.String("url", clue.InfringementURL),
	)

	return nil
}

func generateBatchNo() string {
	return time.Now().Format("20060102150405")
}

func generateReportID() string {
	return fmt.Sprintf("REPORT-%s", time.Now().Format("20060102-150405"))
}

func (n *Notifier) GetStatistics(days int) (map[string]interface{}, error) {
	start := time.Now().AddDate(0, 0, -days)
	end := time.Now()

	clues, err := storage.Global().GetCluesByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	byPlatform := make(map[string]int)
	byType := make(map[string]int)
	var totalSim float64

	for _, c := range clues {
		byPlatform[c.PlatformName]++
		byType[string(c.WorkType)]++
		totalSim += c.Similarity
	}

	avgSim := 0.0
	if len(clues) > 0 {
		avgSim = totalSim / float64(len(clues))
	}

	stats := map[string]interface{}{
		"period_days":       days,
		"total_clues":       len(clues),
		"by_platform":       byPlatform,
		"by_work_type":      byType,
		"avg_similarity":    avgSim,
		"start_date":        start.Format("2006-01-02"),
		"end_date":          end.Format("2006-01-02"),
	}

	return stats, nil
}

func createEmptyCSV(path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{
		"线索ID", "作品名称", "作品类型", "权利人", "联系方式",
		"登记号", "侵权平台", "侵权URL", "侵权标题", "相似度(%)",
		"发现时间", "证据ID", "证据文件路径", "状态",
	}
	return writer.Write(header)
}

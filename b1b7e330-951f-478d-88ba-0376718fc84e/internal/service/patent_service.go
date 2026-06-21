package service

import (
	"encoding/csv"
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"patent-agent/internal/config"
	"patent-agent/internal/model"
	"patent-agent/internal/scraper"
	"patent-agent/pkg/notify"
)

type PatentService struct {
	db         *gorm.DB
	cnipr      *scraper.CNIPRScraper
	cpquery    *scraper.CPQueryScraper
	feequery   *scraper.FeeQueryScraper
	notifier   *notify.MultiNotifier
	cron       *cron.Cron
	alertCfg   *config.AlertConfig
	defaultCfg *config.DefaultConfig
}

type AggregatedPatentStatus struct {
	AppNum          string
	Title           string
	PatentType      string
	Status          string
	EnterpriseName  string
	AgentName       string
	FilingDate      *time.Time
	CNIPRStatus     string
	CPQueryStatus   string
	FeeStatus       string
	NextDueDate     *time.Time
	NextDueType     string
	LastSyncedAt    *time.Time
}

type XMLPatentApplication struct {
	XMLName  xml.Name `xml:"patent-application"`
	AppNum   string   `xml:"app-num"`
	Title    string   `xml:"title"`
	Type     string   `xml:"type"`
	Applicant string  `xml:"applicant"`
	Inventor string   `xml:"inventor"`
	Agent    string   `xml:"agent"`
	Abstract string   `xml:"abstract"`
}

type ExportOptions struct {
	Format       string
	Enterprise   string
	Agent        string
	PatentType   string
	Status       string
}

func NewPatentService(
	db *gorm.DB,
	cnipr *scraper.CNIPRScraper,
	cpquery *scraper.CPQueryScraper,
	feequery *scraper.FeeQueryScraper,
	notifier *notify.MultiNotifier,
	alertCfg *config.AlertConfig,
	defaultCfg *config.DefaultConfig,
) *PatentService {
	return &PatentService{
		db:         db,
		cnipr:      cnipr,
		cpquery:    cpquery,
		feequery:   feequery,
		notifier:   notifier,
		alertCfg:   alertCfg,
		defaultCfg: defaultCfg,
		cron:       cron.New(cron.WithSeconds()),
	}
}

func (s *PatentService) StartScheduler(schedCfg *config.ScheduleConfig) error {
	if _, err := s.cron.AddFunc(schedCfg.AlertCheckCron, func() {
		config.Logger.Info("running scheduled alert check")
		if alerts, err := s.CheckAndSendAlerts(); err != nil {
			config.Logger.Error("scheduled alert check failed", zap.Error(err))
		} else {
			config.Logger.Info("scheduled alert check completed", zap.Int("alertCount", len(alerts)))
		}
	}); err != nil {
		return fmt.Errorf("add alert check cron failed: %w", err)
	}

	if _, err := s.cron.AddFunc(schedCfg.HeartbeatCron, func() {
		config.Logger.Debug("running session heartbeat")
		if s.cnipr != nil {
			s.cnipr.Heartbeat()
		}
		if s.cpquery != nil {
			s.cpquery.Heartbeat()
		}
		if s.feequery != nil {
			s.feequery.Heartbeat()
		}
	}); err != nil {
		return fmt.Errorf("add heartbeat cron failed: %w", err)
	}

	s.cron.Start()
	config.Logger.Info("scheduler started")
	return nil
}

func (s *PatentService) StopScheduler() {
	if s.cron != nil {
		ctx := s.cron.Stop()
		<-ctx.Done()
		config.Logger.Info("scheduler stopped")
	}
}

func (s *PatentService) GetAggregatedStatus(appNum string) (*AggregatedPatentStatus, error) {
	var patent model.PatentApplication
	if err := s.db.Where("app_num = ?", appNum).Preload("Enterprise").First(&patent).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("patent not found: %s", appNum)
		}
		return nil, err
	}

	status := &AggregatedPatentStatus{
		AppNum:         patent.AppNum,
		Title:          patent.Title,
		PatentType:     string(patent.PatentType),
		Status:         string(patent.Status),
		AgentName:      patent.AgentName,
		FilingDate:     patent.FilingDate,
		CNIPRStatus:    patent.CNIPRStatus,
		CPQueryStatus:  patent.CPQueryStatus,
		FeeStatus:      patent.FeeStatus,
		LastSyncedAt:   patent.LastSyncedAt,
	}
	if patent.Enterprise.ID > 0 {
		status.EnterpriseName = patent.Enterprise.Name
	}

	var latestExam model.ExaminationRecord
	s.db.Where("patent_application_id = ?", patent.ID).
		Order("response_deadline DESC").
		First(&latestExam)

	var latestFee model.FeeRecord
	s.db.Where("patent_application_id = ? AND payment_status != ?", patent.ID, "paid").
		Order("due_date ASC").
		First(&latestFee)

	if latestExam.ID > 0 && latestExam.ResponseDeadline != nil {
		if latestFee.ID == 0 || latestFee.DueDate == nil || latestExam.ResponseDeadline.Before(*latestFee.DueDate) {
			status.NextDueDate = latestExam.ResponseDeadline
			status.NextDueType = "审查意见答复"
		}
	}
	if latestFee.ID > 0 && latestFee.DueDate != nil {
		if status.NextDueDate == nil || latestFee.DueDate.Before(*status.NextDueDate) {
			status.NextDueDate = latestFee.DueDate
			status.NextDueType = fmt.Sprintf("第%d年年费", latestFee.FeeYear)
		}
	}

	return status, nil
}

func (s *PatentService) ListPatents(enterprise, agent, patentType string) ([]AggregatedPatentStatus, error) {
	var patents []model.PatentApplication
	query := s.db.Preload("Enterprise")

	if enterprise != "" {
		query = query.Joins("JOIN enterprises ON enterprises.id = patent_applications.enterprise_id").
			Where("enterprises.name LIKE ?", "%"+enterprise+"%")
	}
	if agent != "" {
		query = query.Where("agent_name LIKE ?", "%"+agent+"%")
	}
	if patentType != "" {
		query = query.Where("patent_type = ?", patentType)
	}

	if err := query.Find(&patents).Error; err != nil {
		return nil, err
	}

	var result []AggregatedPatentStatus
	for _, p := range patents {
		status := AggregatedPatentStatus{
			AppNum:        p.AppNum,
			Title:         p.Title,
			PatentType:    string(p.PatentType),
			Status:        string(p.Status),
			AgentName:     p.AgentName,
			FilingDate:    p.FilingDate,
			CNIPRStatus:   p.CNIPRStatus,
			CPQueryStatus: p.CPQueryStatus,
			FeeStatus:     p.FeeStatus,
			LastSyncedAt:  p.LastSyncedAt,
		}
		if p.Enterprise.ID > 0 {
			status.EnterpriseName = p.Enterprise.Name
		}
		result = append(result, status)
	}
	return result, nil
}

func (s *PatentService) SyncSinglePatent(appNum string) error {
	now := time.Now()
	var patent model.PatentApplication
	result := s.db.Where("app_num = ?", appNum).First(&patent)
	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}

	if s.cnipr != nil && s.cnipr.LoggedIn {
		if info, err := s.cnipr.GetPatentStatus(appNum); err == nil {
			patent.CNIPRStatus = info.Status
			if patent.Title == "" {
				patent.Title = info.Title
			}
			if patent.PatentType == "" {
				patent.PatentType = model.PatentType(info.PatentType)
			}
			if patent.Applicant == "" {
				patent.Applicant = info.Applicant
			}
			if patent.Inventor == "" {
				patent.Inventor = info.Inventor
			}
			if patent.AgentName == "" {
				patent.AgentName = info.AgentName
			}
			if info.FilingDate != "" {
				if t, err := parseServiceDate(info.FilingDate); err == nil {
					patent.FilingDate = &t
				}
			}
		} else {
			config.Logger.Warn("sync cnipr failed", zap.String("appNum", appNum), zap.Error(err))
		}
	}

	if s.cpquery != nil && s.cpquery.LoggedIn {
		if info, err := s.cpquery.QueryExaminationInfo(appNum); err == nil {
			patent.CPQueryStatus = info.CurrentStage
			if info.LegalStatus != "" {
				patent.CPQueryStatus = info.LegalStatus
			}
			for _, oa := range info.OfficeActions {
				var existing model.ExaminationRecord
				res := s.db.Where("patent_application_id = ? AND notification_code = ?",
					patent.ID, oa.NotificationCode).First(&existing)
				if errors.Is(res.Error, gorm.ErrRecordNotFound) && oa.NotificationCode != "" {
					exam := model.ExaminationRecord{
						PatentApplicationID: patent.ID,
						OfficeActionType:    oa.NotificationType,
						NotificationCode:    oa.NotificationCode,
						NotificationDate:    oa.NotificationDate,
						ResponseDeadline:    oa.ResponseDeadline,
					}
					s.db.Create(&exam)
				}
			}
		} else {
			config.Logger.Warn("sync cpquery failed", zap.String("appNum", appNum), zap.Error(err))
		}
	}

	if s.feequery != nil && s.feequery.LoggedIn {
		if feeRecords, err := s.feequery.SyncPaymentRecords(appNum); err == nil {
			statuses := make(map[string]bool)
			for _, fr := range feeRecords {
				statuses[fr.PaymentStatus] = true
				fr.PatentApplicationID = patent.ID
				var existing model.FeeRecord
				res := s.db.Where("patent_application_id = ? AND fee_type = ? AND fee_year = ?",
					patent.ID, fr.FeeType, fr.FeeYear).First(&existing)
				if errors.Is(res.Error, gorm.ErrRecordNotFound) {
					s.db.Create(&fr)
				} else {
					fr.ID = existing.ID
					s.db.Save(&fr)
				}
			}
			if statuses["overdue"] {
				patent.FeeStatus = "overdue"
			} else if statuses["unpaid"] {
				patent.FeeStatus = "unpaid"
			} else {
				patent.FeeStatus = "paid"
			}
		} else {
			config.Logger.Warn("sync feequery failed", zap.String("appNum", appNum), zap.Error(err))
		}
	}

	patent.LastSyncedAt = &now
	if patent.ID == 0 {
		return s.db.Create(&patent).Error
	}
	return s.db.Save(&patent).Error
}

func (s *PatentService) SyncAll(progressFn func(current, total int)) (int, error) {
	var allAppNums []string
	s.db.Model(&model.PatentApplication{}).Pluck("app_num", &allAppNums)

	if len(allAppNums) == 0 {
		return 0, nil
	}

	success := 0
	var mu sync.Mutex
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 5)

	for i, appNum := range allAppNums {
		wg.Add(1)
		semaphore <- struct{}{}
		go func(idx int, num string) {
			defer wg.Done()
			defer func() { <-semaphore }()
			if err := s.SyncSinglePatent(num); err == nil {
				mu.Lock()
				success++
				mu.Unlock()
			}
			if progressFn != nil {
				progressFn(idx+1, len(allAppNums))
			}
		}(i, appNum)
	}

	wg.Wait()
	return success, nil
}

func (s *PatentService) CheckAndSendAlerts() ([]model.AlertRecord, error) {
	now := time.Now()
	overdueRisk := now.AddDate(0, 0, s.alertCfg.OverdueRiskDays)
	warning := now.AddDate(0, 0, s.alertCfg.WarningDays)
	reminder := now.AddDate(0, 0, s.alertCfg.ReminderDays)

	var allAlerts []model.AlertRecord

	var exams []model.ExaminationRecord
	s.db.Where("responded = ? AND response_deadline IS NOT NULL AND response_deadline > ?",
		false, now.AddDate(0, 0, -7)).
		Preload("PatentApplication").
		Find(&exams)

	for _, exam := range exams {
		if exam.ResponseDeadline == nil {
			continue
		}
		level := model.AlertInfo
		daysLeft := int(exam.ResponseDeadline.Sub(now).Hours() / 24)

		if exam.ResponseDeadline.Before(now) {
			level = model.AlertCritical
		} else if exam.ResponseDeadline.Before(overdueRisk) {
			level = model.AlertCritical
		} else if exam.ResponseDeadline.Before(warning) {
			level = model.AlertWarning
		} else if !exam.ResponseDeadline.Before(reminder) {
			continue
		}

		alert := s.createOrGetAlert(
			exam.PatentApplicationID,
			"office_action",
			level,
			fmt.Sprintf("%s 审查意见答复期限", exam.PatentApplication.AppNum),
			fmt.Sprintf("申请号: %s\n标题: %s\n审查意见类型: %s\n答复期限: %s\n剩余天数: %d天",
				exam.PatentApplication.AppNum,
				exam.PatentApplication.Title,
				exam.OfficeActionType,
				exam.ResponseDeadline.Format("2006-01-02"),
				daysLeft,
			),
			exam.ResponseDeadline,
		)
		allAlerts = append(allAlerts, alert)
	}

	var fees []model.FeeRecord
	s.db.Where("payment_status != ? AND due_date IS NOT NULL AND due_date > ?",
		"paid", now.AddDate(0, 0, -30)).
		Preload("PatentApplication").
		Find(&fees)

	for _, fee := range fees {
		if fee.DueDate == nil {
			continue
		}
		level := model.AlertInfo
		daysLeft := int(fee.DueDate.Sub(now).Hours() / 24)

		if fee.DueDate.Before(now) {
			level = model.AlertCritical
		} else if fee.DueDate.Before(overdueRisk) {
			level = model.AlertCritical
		} else if fee.DueDate.Before(warning) {
			level = model.AlertWarning
		} else if !fee.DueDate.Before(reminder) {
			continue
		}

		alert := s.createOrGetAlert(
			fee.PatentApplicationID,
			"fee_due",
			level,
			fmt.Sprintf("%s 第%d年年费缴纳", fee.PatentApplication.AppNum, fee.FeeYear),
			fmt.Sprintf("申请号: %s\n标题: %s\n费用类型: %s\n缴费年度: 第%d年\n应缴金额: %.2f元\n滞纳金: %.2f元\n缴费期限: %s\n剩余天数: %d天",
				fee.PatentApplication.AppNum,
				fee.PatentApplication.Title,
				fee.FeeType,
				fee.FeeYear,
				fee.FeeAmount,
				fee.LateFeeAmount,
				fee.DueDate.Format("2006-01-02"),
				daysLeft,
			),
			fee.DueDate,
		)
		allAlerts = append(allAlerts, alert)
	}

	for _, alert := range allAlerts {
		if !alert.Notified && s.notifier != nil {
			n := notify.Notification{
				Title:   alert.AlertTitle,
				Content: alert.AlertContent,
				Level:   string(alert.AlertLevel),
			}
			if err := s.notifier.SendNotification(n); err == nil {
				alert.Notified = true
				t := time.Now()
				alert.NotifiedAt = &t
				s.db.Save(&alert)
			} else {
				config.Logger.Warn("send alert notification failed",
					zap.Uint("alertID", alert.ID),
					zap.Error(err),
				)
			}
		}
	}

	return allAlerts, nil
}

func (s *PatentService) createOrGetAlert(patentID uint, alertType string, level model.AlertLevel, title, content string, dueDate *time.Time) model.AlertRecord {
	var alert model.AlertRecord
	result := s.db.Where("patent_application_id = ? AND alert_type = ? AND due_date = ? AND handled = ?",
		patentID, alertType, dueDate, false).First(&alert)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		alert = model.AlertRecord{
			PatentApplicationID: patentID,
			AlertType:           alertType,
			AlertLevel:          level,
			AlertTitle:          title,
			AlertContent:        content,
			DueDate:             dueDate,
		}
		s.db.Create(&alert)
	} else {
		if alert.AlertLevel != level {
			alert.AlertLevel = level
		}
		alert.AlertTitle = title
		alert.AlertContent = content
		s.db.Save(&alert)
	}
	return alert
}

func (s *PatentService) BatchUploadFeeReduction(enterpriseIDs []uint) (int, []uint, error) {
	var enterprises []model.Enterprise
	s.db.Where("id IN ?", enterpriseIDs).Find(&enterprises)

	certMap := make(map[uint]string)
	var validIDs []uint
	var expiredIDs []uint
	now := time.Now()

	for _, e := range enterprises {
		if e.FeeReductionCertFile == "" {
			continue
		}
		if e.FeeReductionCertExpire != nil && e.FeeReductionCertExpire.Before(now) {
			expiredIDs = append(expiredIDs, e.ID)
			continue
		}
		certMap[e.ID] = e.FeeReductionCertFile
		validIDs = append(validIDs, e.ID)
	}

	if s.cnipr == nil {
		return 0, enterpriseIDs, errors.New("cnipr scraper not initialized")
	}

	return s.cnipr.BatchUploadFeeReduction(validIDs, certMap)
}

func (s *PatentService) ParseXMLApplication(xmlPath string) (*XMLPatentApplication, error) {
	data, err := os.ReadFile(xmlPath)
	if err != nil {
		return nil, err
	}
	var app XMLPatentApplication
	if err := xml.Unmarshal(data, &app); err != nil {
		return nil, err
	}
	return &app, nil
}

func (s *PatentService) BatchSubmitFromDirectory(dirPath string, progressFn func(current, total int)) (success int, failed []string, err error) {
	files, err := filepath.Glob(filepath.Join(dirPath, "*.xml"))
	if err != nil {
		return 0, nil, err
	}
	if len(files) == 0 {
		return 0, nil, fmt.Errorf("no XML files found in %s", dirPath)
	}

	appMap := make(map[string][]string)
	var appNums []string

	for _, f := range files {
		app, err := s.ParseXMLApplication(f)
		if err != nil {
			failed = append(failed, filepath.Base(f))
			continue
		}
		if app.AppNum == "" {
			failed = append(failed, filepath.Base(f)+" (missing app-num)")
			continue
		}
		appNums = append(appNums, app.AppNum)
		appMap[app.AppNum] = []string{f}

		dir := filepath.Dir(f)
		base := strings.TrimSuffix(filepath.Base(f), filepath.Ext(f))
		relatedPatterns := []string{
			filepath.Join(dir, base+".pdf"),
			filepath.Join(dir, base+".doc"),
			filepath.Join(dir, base+".docx"),
			filepath.Join(dir, base+"_claims.pdf"),
			filepath.Join(dir, base+"_description.pdf"),
			filepath.Join(dir, base+"_drawings.pdf"),
		}
		for _, p := range relatedPatterns {
			if _, err := os.Stat(p); err == nil {
				appMap[app.AppNum] = append(appMap[app.AppNum], p)
			}
		}
	}

	if s.cnipr == nil {
		return 0, appNums, errors.New("cnipr scraper not initialized")
	}

	success, failedSubmits := s.cnipr.BatchSubmitApplications(appNums, appMap, progressFn)
	failed = append(failed, failedSubmits...)
	return success, failed, nil
}

func (s *PatentService) ExportData(opts ExportOptions, outputPath string) error {
	patents, err := s.ListPatents(opts.Enterprise, opts.Agent, opts.PatentType)
	if err != nil {
		return err
	}

	switch strings.ToLower(opts.Format) {
	case "excel", "xlsx":
		return s.exportExcel(patents, outputPath)
	case "csv":
		return s.exportCSV(patents, outputPath)
	default:
		return fmt.Errorf("unsupported format: %s", opts.Format)
	}
}

func (s *PatentService) exportExcel(patents []AggregatedPatentStatus, outputPath string) error {
	f := excelize.NewFile()
	sheet := "专利清单"
	index, _ := f.NewSheet(sheet)

	headers := []string{"申请号", "标题", "专利类型", "当前状态", "企业名称", "代理师", "申请日", "CNIPR状态", "CPQuery状态", "缴费状态", "下一个期限", "期限类型", "最后同步时间"}
	for i, h := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheet, cell, h)
	}

	for i, p := range patents {
		row := i + 2
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), p.AppNum)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), p.Title)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), p.PatentType)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), p.Status)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), p.EnterpriseName)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), p.AgentName)
		if p.FilingDate != nil {
			f.SetCellValue(sheet, fmt.Sprintf("G%d", row), p.FilingDate.Format("2006-01-02"))
		}
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), p.CNIPRStatus)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), p.CPQueryStatus)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), p.FeeStatus)
		if p.NextDueDate != nil {
			f.SetCellValue(sheet, fmt.Sprintf("K%d", row), p.NextDueDate.Format("2006-01-02"))
		}
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), p.NextDueType)
		if p.LastSyncedAt != nil {
			f.SetCellValue(sheet, fmt.Sprintf("M%d", row), p.LastSyncedAt.Format("2006-01-02 15:04:05"))
		}
	}

	f.SetActiveSheet(index)
	f.DeleteSheet("Sheet1")

	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	return f.SaveAs(outputPath)
}

func (s *PatentService) exportCSV(patents []AggregatedPatentStatus, outputPath string) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	f, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer f.Close()

	// Write BOM for Excel UTF-8 compatibility
	f.WriteString("\xEF\xBB\xBF")

	w := csv.NewWriter(f)
	defer w.Flush()

	w.Write([]string{"申请号", "标题", "专利类型", "当前状态", "企业名称", "代理师", "申请日", "CNIPR状态", "CPQuery状态", "缴费状态", "下一个期限", "期限类型", "最后同步时间"})

	for _, p := range patents {
		row := []string{
			p.AppNum, p.Title, p.PatentType, p.Status, p.EnterpriseName, p.AgentName,
		}
		if p.FilingDate != nil {
			row = append(row, p.FilingDate.Format("2006-01-02"))
		} else {
			row = append(row, "")
		}
		row = append(row, p.CNIPRStatus, p.CPQueryStatus, p.FeeStatus)
		if p.NextDueDate != nil {
			row = append(row, p.NextDueDate.Format("2006-01-02"))
		} else {
			row = append(row, "")
		}
		row = append(row, p.NextDueType)
		if p.LastSyncedAt != nil {
			row = append(row, p.LastSyncedAt.Format("2006-01-02 15:04:05"))
		} else {
			row = append(row, "")
		}
		w.Write(row)
	}
	return nil
}

func (s *PatentService) GenerateMonthlyReport(year, month int) (map[string]interface{}, error) {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, 0)

	var totalFiled int64
	s.db.Model(&model.PatentApplication{}).
		Where("filing_date >= ? AND filing_date < ?", start, end).
		Count(&totalFiled)

	type TypeCount struct {
		PatentType string
		Count      int64
	}
	var typeCounts []TypeCount
	s.db.Model(&model.PatentApplication{}).
		Select("patent_type, count(*) as count").
		Where("filing_date >= ? AND filing_date < ?", start, end).
		Group("patent_type").
		Scan(&typeCounts)

	var totalAuthorized int64
	s.db.Model(&model.PatentApplication{}).
		Where("authorization_date >= ? AND authorization_date < ?", start, end).
		Count(&totalAuthorized)

	type AgentCount struct {
		AgentName string
		Count     int64
	}
	var agentCounts []AgentCount
	s.db.Model(&model.PatentApplication{}).
		Select("agent_name, count(*) as count").
		Where("filing_date >= ? AND filing_date < ?", start, end).
		Group("agent_name").
		Order("count DESC").
		Limit(10).
		Scan(&agentCounts)

	return map[string]interface{}{
		"period":       fmt.Sprintf("%d年%d月", year, month),
		"totalFiled":   totalFiled,
		"typeCounts":   typeCounts,
		"authorized":   totalAuthorized,
		"agentStats":   agentCounts,
		"generatedAt":  time.Now(),
	}, nil
}

func parseServiceDate(s string) (time.Time, error) {
	layouts := []string{
		"2006-01-02",
		"2006/01/02",
		"2006年01月02日",
		"2006.01.02",
		time.RFC3339,
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, strings.TrimSpace(s), time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized date: %s", s)
}

var _ = strconv.Itoa

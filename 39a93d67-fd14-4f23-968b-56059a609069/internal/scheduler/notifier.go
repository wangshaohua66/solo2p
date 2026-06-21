package scheduler

import (
	"encoding/csv"
	"fmt"
	"os"
	"sort"
	"time"

	"eco-inspector/internal/database"
	"eco-inspector/pkg/logger"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

type WarningItem struct {
	ID                string `json:"id"`
	RectificationID   string `json:"rectification_id"`
	EnterpriseName    string `json:"enterprise_name"`
	EnterpriseID      string `json:"enterprise_id"`
	ProblemType       string `json:"problem_type"`
	ProblemDesc       string `json:"problem_desc"`
	Deadline          string `json:"deadline"`
	DaysRemaining     int    `json:"days_remaining"`
	WarningLevel      int    `json:"warning_level"`
	ResponsiblePerson string `json:"responsible_person"`
	Message           string `json:"message"`
	CreatedAt         string `json:"created_at"`
}

type Notifier struct {
	warningLevels []int
	cronScheduler *cron.Cron
	cronSpec      string
}

func NewNotifier(levels []int) *Notifier {
	sort.Sort(sort.Reverse(sort.IntSlice(levels)))
	return &Notifier{warningLevels: levels}
}

func NewNotifierWithCron(levels []int, cronSpec string) *Notifier {
	sort.Sort(sort.Reverse(sort.IntSlice(levels)))
	return &Notifier{
		warningLevels: levels,
		cronSpec:      cronSpec,
	}
}

func (n *Notifier) StartCron() error {
	if n.cronSpec == "" {
		n.cronSpec = "0 8 * * *"
	}
	if n.cronScheduler != nil {
		return fmt.Errorf("调度器已启动")
	}

	c := cron.New()
	_, err := c.AddFunc(n.cronSpec, func() {
		warnings, err := n.Scan()
		if err != nil {
			logger.Error("定时预警扫描失败", map[string]string{"error": err.Error()})
			return
		}
		logger.Info("定时预警扫描完成", map[string]string{
			"action": "cron_scan",
			"result": fmt.Sprintf("扫描到%d条预警", len(warnings)),
		})
	})
	if err != nil {
		return fmt.Errorf("注册定时任务失败: %w", err)
	}

	n.cronScheduler = c
	c.Start()
	logger.Info("预警调度器启动", map[string]string{
		"action": "cron_start",
		"cron":   n.cronSpec,
		"result": "成功",
	})
	return nil
}

func (n *Notifier) StopCron() {
	if n.cronScheduler != nil {
		ctx := n.cronScheduler.Stop()
		<-ctx.Done()
		logger.Info("预警调度器停止", map[string]string{
			"action": "cron_stop",
			"result": "成功",
		})
	}
}

func (n *Notifier) Scan() ([]WarningItem, error) {
	now := time.Now()
	var warnings []WarningItem

	rows, err := database.DB.Query(`
		SELECT r.id, r.enterprise_id, e.name, r.problem_type, r.problem_desc, r.deadline, r.responsible_person, r.status
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		WHERE r.status IN ('待整改', '整改中')
		ORDER BY r.deadline ASC`)
	if err != nil {
		return nil, fmt.Errorf("查询待整改事项失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var rectID, entID, entName, pType, pDesc, deadline, responsible, status string
		if err := rows.Scan(&rectID, &entID, &entName, &pType, &pDesc, &deadline, &responsible, &status); err != nil {
			continue
		}

		deadlineTime, err := time.Parse("2006-01-02 15:04:05", deadline)
		if err != nil {
			deadlineTime, err = time.Parse("2006-01-02", deadline)
			if err != nil {
				continue
			}
		}

		daysRemaining := int(time.Until(deadlineTime).Hours() / 24)

		level := 0
		for _, l := range n.warningLevels {
			if daysRemaining <= l && daysRemaining >= 0 {
				level = l
			}
		}

		if daysRemaining < 0 {
			level = -1
		}

		if level == 0 {
			continue
		}

		warningLevel := level
		if level == -1 {
			warningLevel = 0
		}

		var msg string
		if daysRemaining < 0 {
			msg = fmt.Sprintf("【已超期】%s - %s，已超期%d天", entName, pDesc, -daysRemaining)
		} else {
			msg = fmt.Sprintf("【%d天预警】%s - %s，距整改期限还有%d天", level, entName, pDesc, daysRemaining)
		}

		createdAt := now.Format("2006-01-02 15:04:05")

		_, _ = database.DB.Exec(`
			INSERT OR IGNORE INTO warnings (id, rectification_id, warning_level, days_remaining, message, is_sent, created_at)
			VALUES (?, ?, ?, ?, ?, 0, ?)`,
			uuid.New().String()[:12], rectID, warningLevel, daysRemaining, msg, createdAt)

		warnings = append(warnings, WarningItem{
			RectificationID:  rectID,
			EnterpriseID:     entID,
			EnterpriseName:   entName,
			ProblemType:      pType,
			ProblemDesc:      pDesc,
			Deadline:         deadline,
			DaysRemaining:    daysRemaining,
			WarningLevel:     warningLevel,
			ResponsiblePerson: responsible,
			Message:          msg,
			CreatedAt:        createdAt,
		})
	}

	if warnings == nil {
		warnings = []WarningItem{}
	}

	logger.LogAction("system", "超期预警扫描", "", fmt.Sprintf("扫描到%d条预警", len(warnings)))
	return warnings, nil
}

func (n *Notifier) GetOverdue() ([]WarningItem, error) {
	now := time.Now()
	var items []WarningItem

	rows, err := database.DB.Query(`
		SELECT r.id, r.enterprise_id, e.name, r.problem_type, r.problem_desc, r.deadline, r.responsible_person
		FROM rectifications r
		LEFT JOIN enterprises e ON r.enterprise_id = e.id
		WHERE r.status IN ('待整改', '整改中') AND r.deadline < ?
		ORDER BY r.deadline ASC`, now.Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("查询超期事项失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var rectID, entID, entName, pType, pDesc, deadline, responsible string
		if err := rows.Scan(&rectID, &entID, &entName, &pType, &pDesc, &deadline, &responsible); err != nil {
			continue
		}

		deadlineTime, _ := time.Parse("2006-01-02", deadline)
		daysOverdue := int(now.Sub(deadlineTime).Hours() / 24)

		msg := fmt.Sprintf("【已超期%d天】%s - %s", daysOverdue, entName, pDesc)

		items = append(items, WarningItem{
			RectificationID:  rectID,
			EnterpriseID:     entID,
			EnterpriseName:   entName,
			ProblemType:      pType,
			ProblemDesc:      pDesc,
			Deadline:         deadline,
			DaysRemaining:    -daysOverdue,
			WarningLevel:     0,
			ResponsiblePerson: responsible,
			Message:          msg,
		})
	}

	if items == nil {
		items = []WarningItem{}
	}
	return items, nil
}

func (n *Notifier) ExportWarningList(filePath string, items []WarningItem) error {
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	defer writer.Flush()

	header := []string{"企业名称", "问题类型", "问题描述", "整改期限", "剩余天数", "预警级别", "责任人", "预警信息"}
	if err := writer.Write(header); err != nil {
		return fmt.Errorf("写入CSV头失败: %w", err)
	}

	for _, w := range items {
		levelStr := ""
		if w.WarningLevel == 0 {
			levelStr = "已超期"
		} else {
			levelStr = fmt.Sprintf("%d天预警", w.WarningLevel)
		}
		record := []string{
			w.EnterpriseName,
			w.ProblemType,
			w.ProblemDesc,
			w.Deadline,
			fmt.Sprintf("%d", w.DaysRemaining),
			levelStr,
			w.ResponsiblePerson,
			w.Message,
		}
		if err := writer.Write(record); err != nil {
			return fmt.Errorf("写入CSV行失败: %w", err)
		}
	}

	logger.LogAction("system", "导出预警清单", filePath, fmt.Sprintf("导出%d条", len(items)))
	return nil
}

func (n *Notifier) GetWarningStats() (map[string]int, error) {
	stats := map[string]int{
		"overdue":     0,
		"level_1":     0,
		"level_3":     0,
		"level_7":     0,
		"total_open":  0,
	}

	rows, err := database.DB.Query(`
		SELECT r.deadline, r.status FROM rectifications r
		WHERE r.status IN ('待整改', '整改中')`)
	if err != nil {
		return nil, fmt.Errorf("查询统计数据失败: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var deadline, status string
		if err := rows.Scan(&deadline, &status); err != nil {
			continue
		}

		stats["total_open"]++

		deadlineTime, err := time.Parse("2006-01-02", deadline)
		if err != nil {
			continue
		}

		daysRemaining := int(time.Until(deadlineTime).Hours() / 24)

		if daysRemaining < 0 {
			stats["overdue"]++
		} else if daysRemaining <= 1 {
			stats["level_1"]++
		} else if daysRemaining <= 3 {
			stats["level_3"]++
		} else if daysRemaining <= 7 {
			stats["level_7"]++
		}
	}

	return stats, nil
}

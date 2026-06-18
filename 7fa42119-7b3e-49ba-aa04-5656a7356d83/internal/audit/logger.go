package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"go.etcd.io/bbolt"

	"secfg/internal/errors"
)

const (
	bucketAuditLogs = "audit_logs"
)

type AuditLog struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	User      string                 `json:"user"`
	Command   string                 `json:"command"`
	Params    map[string]interface{} `json:"params"`
	Result    string                 `json:"result"`
	Success   bool                   `json:"success"`
	FilePath  string                 `json:"file_path"`
	Error     string                 `json:"error,omitempty"`
}

type QueryFilter struct {
	StartTime  time.Time
	EndTime    time.Time
	Command    string
	FilePath   string
	Success    *bool
	MaxResults int
}

type Logger struct {
	db      *bbolt.DB
	baseDir string
}

func NewLogger(baseDir string) (*Logger, *errors.SecfgError) {
	if err := os.MkdirAll(baseDir, 0700); err != nil {
		return nil, errors.New(errors.E011, err, false)
	}

	dbPath := filepath.Join(baseDir, "audit.db")
	db, err := bbolt.Open(dbPath, 0600, &bbolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, errors.New(errors.E013, err, false)
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(bucketAuditLogs))
		return err
	})
	if err != nil {
		db.Close()
		return nil, errors.New(errors.E013, err, false)
	}

	return &Logger{db: db, baseDir: baseDir}, nil
}

func (l *Logger) Close() {
	if l.db != nil {
		l.db.Close()
	}
}

func (l *Logger) Log(command string, params map[string]interface{}, filePath string, success bool, err error) *errors.SecfgError {
	currentUser, _ := user.Current()
	username := "unknown"
	if currentUser != nil {
		username = currentUser.Username
	}

	result := "success"
	errMsg := ""
	if !success {
		result = "failed"
		if err != nil {
			errMsg = err.Error()
		}
	}

	sanitizedParams := make(map[string]interface{})
	for k, v := range params {
		sanitizedParams[k] = sanitizeValue(k, v)
	}

	log := AuditLog{
		ID:        generateLogID(),
		Timestamp: time.Now(),
		User:      username,
		Command:   command,
		Params:    sanitizedParams,
		Result:    result,
		Success:   success,
		FilePath:  filePath,
		Error:     errMsg,
	}

	data, err := json.Marshal(log)
	if err != nil {
		return errors.New(errors.E011, err, false)
	}

	dbErr := l.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketAuditLogs))
		if b == nil {
			return fmt.Errorf("audit logs bucket not found")
		}
		return b.Put([]byte(log.ID), data)
	})

	if dbErr != nil {
		return errors.New(errors.E013, dbErr, false)
	}

	return nil
}

func sanitizeValue(key string, value interface{}) interface{} {
	lowerKey := strings.ToLower(key)
	sensitivePatterns := []string{"password", "secret", "token", "key", "passphrase", "private_key", "api_key"}

	for _, pattern := range sensitivePatterns {
		if strings.Contains(lowerKey, pattern) {
			if strVal, ok := value.(string); ok {
				return maskSensitive(strVal)
			}
		}
	}

	return value
}

func maskSensitive(value string) string {
	if len(value) == 0 {
		return ""
	}
	if len(value) <= 4 {
		return strings.Repeat("*", len(value))
	}
	return value[:2] + strings.Repeat("*", len(value)-4) + value[len(value)-2:]
}

func (l *Logger) Query(filter QueryFilter) ([]AuditLog, *errors.SecfgError) {
	var logs []AuditLog

	err := l.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(bucketAuditLogs))
		if b == nil {
			return nil
		}

		return b.ForEach(func(k, v []byte) error {
			var log AuditLog
			if err := json.Unmarshal(v, &log); err != nil {
				return err
			}

			if matchesFilter(log, filter) {
				logs = append(logs, log)
			}

			return nil
		})
	})

	if err != nil {
		return nil, errors.New(errors.E013, err, false)
	}

	sort.Slice(logs, func(i, j int) bool {
		return logs[i].Timestamp.After(logs[j].Timestamp)
	})

	if filter.MaxResults > 0 && len(logs) > filter.MaxResults {
		logs = logs[:filter.MaxResults]
	}

	return logs, nil
}

func matchesFilter(log AuditLog, filter QueryFilter) bool {
	if !filter.StartTime.IsZero() && log.Timestamp.Before(filter.StartTime) {
		return false
	}

	if !filter.EndTime.IsZero() && log.Timestamp.After(filter.EndTime) {
		return false
	}

	if filter.Command != "" && log.Command != filter.Command {
		return false
	}

	if filter.FilePath != "" && !strings.Contains(log.FilePath, filter.FilePath) {
		return false
	}

	if filter.Success != nil && log.Success != *filter.Success {
		return false
	}

	return true
}

func generateLogID() string {
	return fmt.Sprintf("log_%d", time.Now().UnixNano())
}

func FormatLogsAsTable(logs []AuditLog) string {
	if len(logs) == 0 {
		return "没有找到审计记录"
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("%-25s %-15s %-15s %-50s %-8s\n",
		"时间", "用户", "命令", "文件路径", "状态"))
	sb.WriteString(strings.Repeat("-", 115) + "\n")

	for _, log := range logs {
		status := "成功"
		if !log.Success {
			status = "失败"
		}
		filePath := log.FilePath
		if len(filePath) > 45 {
			filePath = "..." + filePath[len(filePath)-42:]
		}
		sb.WriteString(fmt.Sprintf("%-25s %-15s %-15s %-50s %-8s\n",
			log.Timestamp.Format("2006-01-02 15:04:05"),
			truncate(log.User, 13),
			truncate(log.Command, 13),
			truncate(filePath, 48),
			status))
	}

	sb.WriteString(fmt.Sprintf("\n总计: %d 条记录\n", len(logs)))

	return sb.String()
}

func FormatLogsAsJSON(logs []AuditLog) (string, *errors.SecfgError) {
	data, err := json.MarshalIndent(logs, "", "  ")
	if err != nil {
		return "", errors.New(errors.E008, err, false)
	}
	return string(data), nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

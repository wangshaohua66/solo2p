package cmd

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"bankrupt-monitor/internal/store"
)

const ExportMaxPage = 100

type ExportFlags struct {
	Format   string
	Output   string
	Keyword  string
	Court    string
	FromDate string
	ToDate   string
	SortBy   string
	Page     int
}

func RunExport(configPath string, f *ExportFlags) error {
	_, _, db, err := bootstrap(configPath, false)
	if err != nil {
		return err
	}
	defer db.Close()

	if f.Page > ExportMaxPage {
		return fmt.Errorf("page %d exceeds maximum %d (avoid deep pagination)", f.Page, ExportMaxPage)
	}
	if f.Page < 1 {
		f.Page = 1
	}

	q := &store.CaseQuery{
		Keyword:  f.Keyword,
		Court:    f.Court,
		SortBy:   f.SortBy,
		Page:     f.Page,
		PageSize: 100000,
	}
	if f.FromDate != "" {
		q.FromDate = parseDateFlag(f.FromDate)
	}
	if f.ToDate != "" {
		q.ToDate = parseDateFlag(f.ToDate)
	}

	cases, total, err := db.QueryCases(q)
	if err != nil {
		return fmt.Errorf("query: %w", err)
	}

	out := os.Stdout
	if f.Output != "" && f.Output != "-" {
		out, err = os.Create(f.Output)
		if err != nil {
			return fmt.Errorf("create output: %w", err)
		}
		defer out.Close()
	}

	switch strings.ToLower(f.Format) {
	case "csv":
		w := csv.NewWriter(out)
		w.UseCRLF = true
		header := []string{"ID", "债务人", "案号", "标准化案号", "法院", "法院级别", "类型", "管理人",
			"债权人", "裁定字号", "债权申报截止", "开庭时间", "行业", "标签", "告警命中", "已读", "撤稿", "创建时间"}
		if err := w.Write(header); err != nil {
			return err
		}
		for _, c := range cases {
			row := []string{
				strconv.FormatUint(c.ID, 10),
				c.Debtor, c.CaseNumber, c.CaseNumberNorm,
				c.Court, string(c.CourtLevel), string(c.AnnouncementType),
				c.Administrator, c.Creditors, c.RulingNumber,
				formatTimePtr(c.ClaimDeadline), formatTimePtr(c.FirstHearingDate),
				c.Industry, c.Tags,
				boolStr(c.HitSubscription), boolStr(c.IsRead), boolStr(c.IsWithdrawn),
				c.CreatedAt.Format(time.RFC3339),
			}
			if err := w.Write(row); err != nil {
				return err
			}
		}
		w.Flush()
		return w.Error()

	case "json":
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		return enc.Encode(map[string]interface{}{
			"total":     total,
			"exported":  len(cases),
			"export_at": time.Now().Format(time.RFC3339),
			"items":     cases,
		})

	default:
		return fmt.Errorf("unsupported format: %s (use csv or json)", f.Format)
	}
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

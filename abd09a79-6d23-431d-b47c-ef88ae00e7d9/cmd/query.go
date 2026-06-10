package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/parser"
	"bankrupt-monitor/internal/store"

	"github.com/olekukonko/tablewriter"
)

type QueryFlags struct {
	Keyword   string
	Court     string
	Debtor    string
	CaseNum   string
	Type      string
	FromDate  string
	ToDate    string
	SortBy    string
	SortOrder string
	Page      int
	PageSize  int
	IsRead    *bool
	HitOnly   bool
	Withdrawn *bool
	AsJSON    bool
	Highlight bool
}

func RunQuery(configPath string, f *QueryFlags) error {
	_, _, db, err := bootstrap(configPath, false)
	if err != nil {
		return err
	}
	defer db.Close()

	q := &store.CaseQuery{
		Keyword:    f.Keyword,
		Court:      f.Court,
		Debtor:     f.Debtor,
		CaseNumber: f.CaseNum,
		SortBy:     f.SortBy,
		SortOrder:  f.SortOrder,
		Page:       f.Page,
		PageSize:   f.PageSize,
		IsRead:     f.IsRead,
		Withdrawn:  f.Withdrawn,
	}
	if f.Type != "" {
		q.AnnouncementType = f.Type
	}
	if f.HitOnly {
		b := true
		q.HitSubscription = &b
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

	if f.AsJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(map[string]interface{}{
			"total": total,
			"page":  f.Page,
			"size":  f.PageSize,
			"items": cases,
		})
	}

	table := tablewriter.NewWriter(os.Stdout)
	table.Header([]string{"ID", "债务人", "案号", "法院", "类型", "申报截止", "告警", "已读", "创建时间"})

	for _, c := range cases {
		row := []string{
			strconv.FormatUint(c.ID, 10),
			highlightIf(c.Debtor, f.Keyword, f.Highlight),
			highlightIf(c.CaseNumber, f.Keyword, f.Highlight),
			c.Court,
			typeLabel(c.AnnouncementType),
			formatTimePtr(c.ClaimDeadline),
			boolMark(c.HitSubscription),
			boolMark(c.IsRead),
			c.CreatedAt.Format("2006-01-02 15:04"),
		}
		table.Append(row)
	}

	table.Render()
	fmt.Printf("\n共 %d 条记录，第 %d/%d 页\n", total, f.Page, (total+int64(f.PageSize)-1)/int64(f.PageSize))
	return nil
}

func parseDateFlag(s string) *time.Time {
	layouts := []string{"2006-01-02", "2006/01/02", "20060102"}
	for _, l := range layouts {
		if t, err := time.ParseInLocation(l, s, time.Local); err == nil {
			return &t
		}
	}
	return nil
}

func formatTimePtr(t *time.Time) string {
	if t == nil {
		return "-"
	}
	return t.Format("2006-01-02")
}

func boolMark(b bool) string {
	if b {
		return "✔"
	}
	return ""
}

func typeLabel(t model.AnnouncementType) string {
	switch t {
	case model.TypeReorganization:
		return "重整"
	case model.TypeLiquidation:
		return "清算"
	case model.TypeClaimNotice:
		return "债权申报"
	case model.TypeMeeting:
		return "债权人会议"
	default:
		return "其他"
	}
}

func highlightIf(s, kw string, enable bool) string {
	if !enable || kw == "" {
		return s
	}
	return parser.HighlightKeyword(s, kw)
}

var _ = strings.Contains

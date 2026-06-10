package web

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
	"time"

	"bankrupt-monitor/internal/config"
	"bankrupt-monitor/internal/model"
	"bankrupt-monitor/internal/parser"
	"bankrupt-monitor/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.uber.org/zap"
)

//go:embed templates/* static/*
var embedFS embed.FS

type Handler struct {
	db     *store.Store
	logger *zap.Logger
	cfg    *config.AppConfig
	tpl    *template.Template
}

func NewHandler(db *store.Store, log *zap.Logger, cfg *config.AppConfig) *Handler {
	h := &Handler{db: db, logger: log, cfg: cfg}

	tplFS, err := fs.Sub(embedFS, "templates")
	if err != nil {
		panic(err)
	}
	funcMap := template.FuncMap{
		"formatTime": func(t *time.Time) string {
			if t == nil {
				return "-"
			}
			return t.Format("2006-01-02")
		},
		"formatTimeFull": func(t time.Time) string {
			return t.Format("2006-01-02 15:04")
		},
		"typeLabel": typeLabel,
		"typeBadge": func(t model.AnnouncementType) string {
			switch t {
			case model.TypeReorganization:
				return "bg-primary"
			case model.TypeLiquidation:
				return "bg-danger"
			case model.TypeClaimNotice:
				return "bg-warning text-dark"
			case model.TypeMeeting:
				return "bg-info text-dark"
			default:
				return "bg-secondary"
			}
		},
		"boolMark": func(b bool) string {
			if b {
				return "✔"
			}
			return ""
		},
		"highlight": func(text, kw string) template.HTML {
			return template.HTML(parser.HighlightKeyword(text, kw))
		},
		"courtLevelLabel": courtLevelLabel,
		"split":          strings.Split,
		"add":            func(a, b int) int { return a + b },
		"sub":            func(a, b int) int { return a - b },
		"indexAnnURL": func(c *model.Case) string {
			if len(c.Announcements) > 0 {
				return c.Announcements[0].SourceURL
			}
			return "#"
		},
	}
	h.tpl = template.Must(template.New("").Funcs(funcMap).ParseFS(tplFS, "*.html"))
	return h
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5))

	staticFS, _ := fs.Sub(embedFS, "static")
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

	r.Get("/", h.index)
	r.Get("/cases", h.listCases)
	r.Get("/cases/{id}", h.getCase)
	r.Post("/cases/{id}/read", h.markCaseRead)
	r.Post("/cases/batch-read", h.batchMarkRead)
	r.Post("/cases/batch-tag", h.batchTag)
	r.Get("/subscriptions", h.listSubscriptions)
	r.Post("/subscriptions", h.addSubscription)
	r.Delete("/subscriptions/{id}", h.deleteSubscription)
	r.Get("/api/hits", h.apiHits)
	r.Get("/api/stats", h.apiStats)
	r.Get("/dead-letters", h.listDeadLetters)

	return r
}

func (h *Handler) index(w http.ResponseWriter, r *http.Request) {
	h.render(w, "index.html", map[string]interface{}{
		"PageTitle": "破产案件监控",
	})
}

func (h *Handler) listCases(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	size, _ := strconv.Atoi(q.Get("size"))
	if size < 1 || size > 100 {
		size = 20
	}

	query := &store.CaseQuery{
		Keyword:    q.Get("q"),
		Court:      q.Get("court"),
		Debtor:     q.Get("debtor"),
		CaseNumber: q.Get("case"),
		Page:       page,
		PageSize:   size,
		SortBy:     q.Get("sort"),
		SortOrder:  q.Get("order"),
	}
	if v := q.Get("type"); v != "" {
		query.AnnouncementType = v
	}
	if v := q.Get("hit"); v == "1" {
		b := true
		query.HitSubscription = &b
	}
	if v := q.Get("read"); v != "" {
		b := v == "1"
		query.IsRead = &b
	}

	cases, total, err := h.db.QueryCases(query)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	if r.Header.Get("HX-Request") != "" {
		h.renderPartial(w, "case_rows.html", map[string]interface{}{
			"Cases":   cases,
			"Keyword": q.Get("q"),
		})
		return
	}

	h.render(w, "list.html", map[string]interface{}{
		"PageTitle":  "案件列表",
		"Cases":      cases,
		"Total":      total,
		"Page":       page,
		"PageSize":   size,
		"TotalPages": (total + int64(size) - 1) / int64(size),
		"Query":      q,
	})
}

func (h *Handler) getCase(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}
	c, err := h.db.GetCaseByID(id)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}

	if r.Header.Get("HX-Request") != "" {
		h.renderPartial(w, "case_detail.html", map[string]interface{}{
			"Case": c,
		})
		return
	}
	h.render(w, "detail.html", map[string]interface{}{
		"PageTitle": c.Debtor,
		"Case":      c,
	})
}

func (h *Handler) markCaseRead(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}
	read := r.FormValue("read") != "0"
	if err := h.db.MarkCaseRead([]uint64{id}, read); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) batchMarkRead(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	var ids []uint64
	for _, v := range r.Form["ids"] {
		if id, err := strconv.ParseUint(strings.TrimSpace(v), 10, 64); err == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		ids = parseIDs(r.FormValue("ids"))
	}
	if len(ids) == 0 {
		w.WriteHeader(204)
		return
	}
	if err := h.db.MarkCaseRead(ids, true); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cases, total, err := h.db.QueryCases(&store.CaseQuery{Page: 1, PageSize: 20})
	if err != nil {
		w.WriteHeader(204)
		return
	}
	h.renderPartial(w, "case_rows.html", map[string]interface{}{
		"Cases": cases,
		"Total": total,
	})
}

func (h *Handler) batchTag(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	var ids []uint64
	for _, v := range r.Form["ids"] {
		if id, err := strconv.ParseUint(strings.TrimSpace(v), 10, 64); err == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		ids = parseIDs(r.FormValue("ids"))
	}
	tag := strings.TrimSpace(r.FormValue("tag"))
	if len(ids) == 0 || tag == "" {
		w.WriteHeader(204)
		return
	}
	if err := h.db.TagCases(ids, tag); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cases, total, err := h.db.QueryCases(&store.CaseQuery{Page: 1, PageSize: 20})
	if err != nil {
		w.WriteHeader(204)
		return
	}
	h.renderPartial(w, "case_rows.html", map[string]interface{}{
		"Cases": cases,
		"Total": total,
	})
}

func (h *Handler) listSubscriptions(w http.ResponseWriter, r *http.Request) {
	subs, err := h.db.GetSubscriptions(false)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if r.Header.Get("HX-Request") != "" {
		h.renderPartial(w, "sub_list.html", map[string]interface{}{
			"Subscriptions": subs,
		})
		return
	}
	h.render(w, "subscriptions.html", map[string]interface{}{
		"PageTitle":     "订阅管理",
		"Subscriptions": subs,
	})
}

func (h *Handler) addSubscription(w http.ResponseWriter, r *http.Request) {
	keyword := strings.TrimSpace(r.FormValue("keyword"))
	if keyword == "" {
		http.Error(w, "keyword required", 400)
		return
	}
	sub := &model.Subscription{
		Keyword:     keyword,
		KeywordNorm: parser.NormalizeDebtor(keyword),
		MatchType:   r.FormValue("match_type"),
		Category:    r.FormValue("category"),
		Channels:    r.FormValue("channels"),
		Enabled:     r.FormValue("enabled") != "0",
	}
	if sub.MatchType == "" {
		sub.MatchType = "contains"
	}
	if err := h.db.AddSubscription(sub); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	http.Redirect(w, r, "/subscriptions", 303)
}

func (h *Handler) deleteSubscription(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}
	if err := h.db.DeleteSubscription(id); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) apiHits(w http.ResponseWriter, r *http.Request) {
	b := true
	q := &store.CaseQuery{
		HitSubscription: &b,
		IsRead:          boolPtr(false),
		PageSize:        50,
	}
	cases, total, err := h.db.QueryCases(q)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total": total,
		"items": cases,
	})
}

func (h *Handler) apiStats(w http.ResponseWriter, r *http.Request) {
	var total, todayNew, hitCount, unread, withdrawn int64
	h.db.DB().Model(&model.Case{}).Count(&total)
	today := time.Now().Truncate(24 * time.Hour)
	h.db.DB().Model(&model.Case{}).Where("created_at >= ?", today).Count(&todayNew)
	h.db.DB().Model(&model.Case{}).Where("hit_subscription = ? AND is_read = ?", true, false).Count(&hitCount)
	h.db.DB().Model(&model.Case{}).Where("is_read = ?", false).Count(&unread)
	h.db.DB().Model(&model.Case{}).Where("is_withdrawn = ?", true).Count(&withdrawn)

	if r.Header.Get("HX-Request") != "" {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, `
<div class="row g-2 mb-3">
  <div class="col"><div class="stat-card bg-primary"><small>案件总数</small><h4>%d</h4></div></div>
  <div class="col"><div class="stat-card bg-success"><small>今日新增</small><h4>%d</h4></div></div>
  <div class="col"><div class="stat-card bg-danger"><small>告警未读</small><h4>%d</h4></div></div>
  <div class="col"><div class="stat-card bg-warning text-dark"><small>全部未读</small><h4>%d</h4></div></div>
  <div class="col"><div class="stat-card bg-secondary"><small>已撤稿</small><h4>%d</h4></div></div>
</div>`, total, todayNew, hitCount, unread, withdrawn)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int64{
		"total_cases":    total,
		"today_new":      todayNew,
		"hit_count":      hitCount,
		"unread_count":   unread,
		"withdrawn_count": withdrawn,
	})
}

func (h *Handler) listDeadLetters(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	dls, err := h.db.GetDeadLetters(limit)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	h.render(w, "dead_letters.html", map[string]interface{}{
		"PageTitle":   "死信队列",
		"DeadLetters": dls,
	})
}

func (h *Handler) render(w http.ResponseWriter, name string, data map[string]interface{}) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tplFS, _ := fs.Sub(embedFS, "templates")
	t := template.Must(h.tpl.Clone())
	tmpl, err := t.ParseFS(tplFS, name)
	if err != nil {
		h.logger.Error("parse page template failed", zap.String("template", name), zap.Error(err))
		http.Error(w, err.Error(), 500)
		return
	}
	if err := tmpl.ExecuteTemplate(w, "base.html", data); err != nil {
		h.logger.Error("template render failed", zap.String("template", name), zap.Error(err))
	}
}

func (h *Handler) renderPartial(w http.ResponseWriter, name string, data map[string]interface{}) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.tpl.ExecuteTemplate(w, name, data); err != nil {
		h.logger.Error("partial render failed", zap.String("template", name), zap.Error(err))
		http.Error(w, err.Error(), 500)
	}
}

func parseIDs(s string) []uint64 {
	var result []uint64
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if id, err := strconv.ParseUint(part, 10, 64); err == nil {
			result = append(result, id)
		}
	}
	return result
}

func boolPtr(b bool) *bool { return &b }

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

func courtLevelLabel(l model.CourtLevel) string {
	switch l {
	case model.CourtLevelSupreme:
		return "最高院"
	case model.CourtLevelHigh:
		return "高院"
	case model.CourtLevelMiddle:
		return "中院"
	case model.CourtLevelBasic:
		return "基层"
	default:
		return string(l)
	}
}

var _ = fmt.Sprintf
